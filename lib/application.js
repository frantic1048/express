/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * 模块依赖
 * @private
 */

var finalhandler = require('finalhandler');
var Router = require('./router');
var methods = require('methods');
var middleware = require('./middleware/init');
var query = require('./middleware/query');
var debug = require('debug')('express:application');
var View = require('./view');
var http = require('http');
var compileETag = require('./utils').compileETag;
var compileQueryParser = require('./utils').compileQueryParser;
var compileTrust = require('./utils').compileTrust;
var deprecate = require('depd')('express');
var flatten = require('array-flatten');
var merge = require('utils-merge');
var resolve = require('path').resolve;
var slice = Array.prototype.slice;

/**
 * 程序原型（prototype）.
 */

var app = exports = module.exports = {};

/**
 * 用来处理信任代理继承向后兼容的变量
 * @private
 */

var trustProxyDefaultSymbol = '@@symbol:trust_proxy_default';

/**
 * 初始化服务器
 *
 *   - 设定默认配置
 *   - 设定默认中间件
 *   - 设定默认路由反射方法
 *
 * @private
 */

app.init = function init() {
  this.cache = {};
  this.engines = {};
  this.settings = {};

  this.defaultConfiguration();
};

/**
 * 初始化程序配置
 * @private
 */

app.defaultConfiguration = function defaultConfiguration() {
  var env = process.env.NODE_ENV || 'development';

  // 默认配置
  this.enable('x-powered-by');
  this.set('etag', 'weak');
  this.set('env', env);
  this.set('query parser', 'extended');
  this.set('subdomain offset', 2);
  this.set('trust proxy', false);

  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true
  });

  debug('booting in %s mode', env);

  this.on('mount', function onmount(parent) {
    // 继承信任代理
    if (this.settings[trustProxyDefaultSymbol] === true
      && typeof parent.settings['trust proxy fn'] === 'function') {
      delete this.settings['trust proxy'];
      delete this.settings['trust proxy fn'];
    }

    // 继承原型
    this.request.__proto__ = parent.request;
    this.response.__proto__ = parent.response;
    this.engines.__proto__ = parent.engines;
    this.settings.__proto__ = parent.settings;
  });

  // 语言环境设置
  this.locals = Object.create(null);

  // 挂载顶级 app 于根目录 /
  this.mountpath = '/';

  // 默认语言环境
  this.locals.settings = this.settings;

  // 默认配置
  this.set('view', View);
  this.set('views', resolve('views'));
  this.set('jsonp callback name', 'callback');

  if (env === 'production') {
    this.enable('view cache');
  }

  Object.defineProperty(this, 'router', {
    get: function() {
      throw new Error('\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.');
    }
  });
};

/**
 * 如果路由没有被添加，延时加载基础路由
 *
 * 基础路由无法在默认配置里设定，因为基础路由读取的配置可能是在程序运行之后的
 *
 * @private
 */
app.lazyrouter = function lazyrouter() {
  if (!this._router) {
    this._router = new Router({
      caseSensitive: this.enabled('case sensitive routing'),
      strict: this.enabled('strict routing')
    });

    this._router.use(query(this.get('query parser fn')));
    this._router.use(middleware.init(this));
  }
};

/**
 * 触发一对请求、响应到程序，启动管线处理
 *
 * 如果没有提供回调，默认的错误处理器会在错误从从栈中出来的时候捕获它
 *
 * @private
 */

app.handle = function handle(req, res, callback) {
  var router = this._router;

  // 最终的处理器
  var done = callback || finalhandler(req, res, {
    env: this.get('env'),
    onerror: logerror.bind(this)
  });

  // 没有路由的情形
  if (!router) {
    debug('no routes defined on app');
    done();
    return;
  }

  router.handle(req, res, done);
};

/**
 * 代理 `Router#use()` 来添加中间件到路由上
 *
 * 如果 _fn_ 参数是 express 应用, 那么它会被挂载到 _route_ 指定的位置
 *
 * @public
 */

app.use = function use(fn) {
  var offset = 0;
  var path = '/';

  // 默认使用 '/'
  // 消除 app.use([fn]) 的歧义
  if (typeof fn !== 'function') {
    var arg = fn;

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }

    // 第一个参数是路径
    if (typeof arg !== 'function') {
      offset = 1;
      path = fn;
    }
  }

  var fns = flatten(slice.call(arguments, offset));

  if (fns.length === 0) {
    throw new TypeError('app.use() requires middleware functions');
  }

  // 设定路由
  this.lazyrouter();
  var router = this._router;

  fns.forEach(function (fn) {
    // 非 express 应用
    if (!fn || !fn.handle || !fn.set) {
      return router.use(path, fn);
    }

    debug('.use app under %s', path);
    fn.mountpath = path;
    fn.parent = this;

    // 恢复请求和响应上的 .app 属性
    router.use(path, function mounted_app(req, res, next) {
      var orig = req.app;
      fn.handle(req, res, function (err) {
        req.__proto__ = orig.request;
        res.__proto__ = orig.response;
        next(err);
      });
    });

    // 挂载应用
    fn.emit('mount', this);
  }, this);

  return this;
};

/**
 * 代理 `Router#route()`
 * 返回一个新的路径为 _path_ 的 `Route` 实例.
 *
 * 路径是独立的拥有特定路径的中间件栈
 *
 * @public
 */

app.route = function route(path) {
  this.lazyrouter();
  return this._router.route(path);
};

/**
 * 将给定的模板引擎回调函数注册成扩展名
 *
 * 默认情况下 `require()` 引擎基于文件扩展名
 * 比如尝试渲染名为 "foo.jade" 的文件的时候
 * Express 内部是这么调用的：
 *
 *     app.engine('jade', require('jade').__express);
 *
 * 对于没有直接提供 `.__express` 方法的引擎，
 * 或者想要自己映射文件扩展名到不同的引擎的话就需要用这个方法，
 * 例如将 EJS 引擎映射到 ".html" 文件上：
 *
 *     app.engine('html', require('ejs').renderFile);
 *
 * @param {String} ext
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.engine = function engine(ext, fn) {
  if (typeof fn !== 'function') {
    throw new Error('callback function required');
  }

  // 获取文件扩展名
  var extension = ext[0] !== '.'
    ? '.' + ext
    : ext;

  // 保存引擎
  this.engines[extension] = fn;

  return this;
};

/**
 * 添加 api 特性的代理 `Router#param()`
 * _name_ 参数可以是名字的数组
 *
 * @param {String|Array} name
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.param = function param(name, fn) {
  this.lazyrouter();

  if (Array.isArray(name)) {
    for (var i = 0; i < name.length; i++) {
      this.param(name[i], fn);
    }

    return this;
  }

  this._router.param(name, fn);

  return this;
};

/**
 * 将 `setting` 赋值到 `val`, 或者返回 `setting` 的值.
 *
 *    app.set('foo', 'bar');
 *    app.get('foo');
 *    // => "bar"
 *
 * 被挂载的服务器会继承父服务器的设定
 *
 * @param {String} setting
 * @param {*} [val]
 * @return {Server} for chaining
 * @public
 */

app.set = function set(setting, val) {
  if (arguments.length === 1) {
    // app.get(setting)
    return this.settings[setting];
  }

  debug('set "%s" to %o', setting, val);

  // 设定值
  this.settings[setting] = val;

  // 触发匹配的设定
  switch (setting) {
    case 'etag':
      this.set('etag fn', compileETag(val));
      break;
    case 'query parser':
      this.set('query parser fn', compileQueryParser(val));
      break;
    case 'trust proxy':
      this.set('trust proxy fn', compileTrust(val));

      // 信任代理继承的向后兼容
      Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
        configurable: true,
        value: false
      });

      break;
  }

  return this;
};

/**
 * 返回应用的绝对路径，
 * 基于挂载它的父应用
 *
 * 如应用自己的挂载路径是 "/admin"，
 * 然后它自己又被挂载到了 "/blog" 下面，
 * 那么返回值就是 "/blog/admin"
 *
 * @return {String}
 * @private
 */

app.path = function path() {
  return this.parent
    ? this.parent.path() + this.mountpath
    : '';
};

/**
 * 检查 `setting` 是否启用（为真值）.
 *
 *    app.enabled('foo')
 *    // => false
 *
 *    app.enable('foo')
 *    app.enabled('foo')
 *    // => true
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.enabled = function enabled(setting) {
  return Boolean(this.set(setting));
};

/**
 * 检查 `setting` 是否禁用.
 *
 *    app.disabled('foo')
 *    // => true
 *
 *    app.enable('foo')
 *    app.disabled('foo')
 *    // => false
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.disabled = function disabled(setting) {
  return !this.set(setting);
};

/**
 * 启用 `setting`.
 *
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.enable = function enable(setting) {
  return this.set(setting, true);
};

/**
 * 禁用 `setting`.
 *
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.disable = function disable(setting) {
  return this.set(setting, false);
};

/**
 * 发送 `.VERB(...)` 调用到 `router.VERB(...)`.
 */

methods.forEach(function(method){
  app[method] = function(path){
    if (method === 'get' && arguments.length === 1) {
      // app.get(setting)
      return this.set(path);
    }

    this.lazyrouter();

    var route = this._router.route(path);
    route[method].apply(route, slice.call(arguments, 1));
    return this;
  };
});

/**
 * 特殊的 "all" 方法, 应用路由的 `path`,
 * 中间件, 和回调到所有的 HTTP 方法上
 *
 * @param {String} path
 * @param {Function} ...
 * @return {app} for chaining
 * @public
 */

app.all = function all(path) {
  this.lazyrouter();

  var route = this._router.route(path);
  var args = slice.call(arguments, 1);

  for (var i = 0; i < methods.length; i++) {
    route[methods[i]].apply(route, args);
  }

  return this;
};

// del -> delete 的别名

app.del = deprecate.function(app.delete, 'app.del: Use app.delete instead');

/**
 * 用 `options` 渲染给定的视图 `name` 名字
 * 以及接收错误和渲染后的模板字符的回调函数
 *
 * 例子:
 *
 *    app.render('email', { name: 'Tobi' }, function(err, html){
 *      // ...
 *    })
 *
 * @param {String} name
 * @param {Object|Function} options or fn
 * @param {Function} callback
 * @public
 */

app.render = function render(name, options, callback) {
  var cache = this.cache;
  var done = callback;
  var engines = this.engines;
  var opts = options;
  var renderOptions = {};
  var view;

  // 支持回调函数作为第二个参数
  if (typeof options === 'function') {
    done = options;
    opts = {};
  }

  // 合并 app.locals
  merge(renderOptions, this.locals);

  // 合并 options._locals
  if (opts._locals) {
    merge(renderOptions, opts._locals);
  }

  // 合并 options
  merge(renderOptions, opts);

  // 除非提供了特定设置，设定 .cache
  if (renderOptions.cache == null) {
    renderOptions.cache = this.enabled('view cache');
  }

  // 首选缓存
  if (renderOptions.cache) {
    view = cache[name];
  }

  // 视图
  if (!view) {
    var View = this.get('view');

    view = new View(name, {
      defaultEngine: this.get('view engine'),
      root: this.get('views'),
      engines: engines
    });

    if (!view.path) {
      var dirs = Array.isArray(view.root) && view.root.length > 1
        ? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
        : 'directory "' + view.root + '"'
      var err = new Error('Failed to lookup view "' + name + '" in views ' + dirs);
      err.view = view;
      return done(err);
    }

    // 更新缓存
    if (renderOptions.cache) {
      cache[name] = view;
    }
  }

  // 渲染
  tryRender(view, renderOptions, done);
};

/**
 * 监听链接
 *
 * 返回一个 Node `http.Server` 实例，
 * 同时将自己应用自己作为回调。
 * 如果想要同时创建 HTTP 和 HTTPS 服务器的话，需要这么做
 *
 *    var http = require('http')
 *      , https = require('https')
 *      , express = require('express')
 *      , app = express();
 *
 *    http.createServer(app).listen(80);
 *    https.createServer({ ... }, app).listen(443);
 *
 * @return {http.Server}
 * @public
 */

app.listen = function listen() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
};

/**
 * 用 console.error 记录错误日志.
 *
 * @param {Error} err
 * @private
 */

function logerror(err) {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') console.error(err.stack || err.toString());
}

/**
 * 尝试渲染一个视图.
 * @private
 */

function tryRender(view, options, callback) {
  try {
    view.render(options, callback);
  } catch (err) {
    callback(err);
  }
}
