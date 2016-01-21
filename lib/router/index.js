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

var Route = require('./route');
var Layer = require('./layer');
var methods = require('methods');
var mixin = require('utils-merge');
var debug = require('debug')('express:router');
var deprecate = require('depd')('express');
var flatten = require('array-flatten');
var parseUrl = require('parseurl');

/**
 * 模块变量
 * @private
 */

var objectRegExp = /^\[object (\S+)\]$/;
var slice = Array.prototype.slice;
var toString = Object.prototype.toString;

/**
 * 用给定的 `options` 初始化 `Router`
 *
 * @param {Object} 选项
 * @return {Router} 可调用的函数
 * @public
 */

var proto = module.exports = function(options) {
  var opts = options || {};

  function router(req, res, next) {
    router.handle(req, res, next);
  }

  // mixin Router class functions
  router.__proto__ = proto;

  router.params = {};
  router._params = [];
  router.caseSensitive = opts.caseSensitive;
  router.mergeParams = opts.mergeParams;
  router.strict = opts.strict;
  router.stack = [];

  return router;
};

/**
 * 将给定的参数的占位符 `name`(s) 映射到给定的回调函数上
 *
 *
 * 参数映射用于使用了一般化的占位符的预置情形
 * 例如 _:user_id_ 参数会自动从数据库中的 _user_ 信息里面加载，不需要额外的代码
 *
 *
 * 回调使用和中间件一样的调用形式，
 * 唯一的区别是占位符的值被传递了，
 * 这个例子里是 _user_ 的 _id_
 * 一旦调用了 `next()` 函数，
 * 它就像中间件一样会继续执行路由，或者参数子序列中的函数
 *
 * 和中间件类似，用户必须响应请求，或者调用 next
 * 来避免请求被搁置
 *
 *  app.param('user_id', function(req, res, next, id){
 *    User.find(id, function(err, user){
 *      if (err) {
 *        return next(err);
 *      } else if (!user) {
 *        return next(new Error('failed to load user'));
 *      }
 *      req.user = user;
 *      next();
 *    });
 *  });
 *
 * @param {String} name
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

proto.param = function param(name, fn) {
  // 参数逻辑
  if (typeof name === 'function') {
    deprecate('router.param(fn): Refactor to use path params');
    this._params.push(name);
    return;
  }

  // 应用参数的函数
  var params = this._params;
  var len = params.length;
  var ret;

  if (name[0] === ':') {
    deprecate('router.param(' + JSON.stringify(name) + ', fn): Use router.param(' + JSON.stringify(name.substr(1)) + ', fn) instead');
    name = name.substr(1);
  }

  for (var i = 0; i < len; ++i) {
    if (ret = params[i](name, fn)) {
      fn = ret;
    }
  }

  // 保证以中间件函数来结尾
  if ('function' != typeof fn) {
    throw new Error('invalid param() call for ' + name + ', got ' + fn);
  }

  (this.params[name] = this.params[name] || []).push(fn);
  return this;
};

/**
 * 发送请求和响应给路由
 * @private
 */

proto.handle = function handle(req, res, out) {
  var self = this;

  debug('dispatching %s %s', req.method, req.url);

  var search = 1 + req.url.indexOf('?');
  var pathlength = search ? search - 1 : req.url.length;
  var fqdn = req.url[0] !== '/' && 1 + req.url.substr(0, pathlength).indexOf('://');
  var protohost = fqdn ? req.url.substr(0, req.url.indexOf('/', 2 + fqdn)) : '';
  var idx = 0;
  var removed = '';
  var slashAdded = false;
  var paramcalled = {};

  // 为 OPTIONS 请求保存选项
  // 仅用于 OPTIONS 请求
  var options = [];

  // 中间件和路由
  var stack = self.stack;

  // 管理内部路由变量
  var parentParams = req.params;
  var parentUrl = req.baseUrl || '';
  var done = restore(out, req, 'baseUrl', 'next', 'params');

  // 设定下一个 layer
  req.next = next;

  // 对于 OPTIONS 请求, 没有响应体的时候响应默认内容
  if (req.method === 'OPTIONS') {
    done = wrap(done, function(old, err) {
      if (err || options.length === 0) return old(err);
      sendOptionsResponse(res, options, old);
    });
  }

  // 设定基础请求值
  req.baseUrl = parentUrl;
  req.originalUrl = req.originalUrl || req.url;

  next();

  function next(err) {
    var layerError = err === 'route'
      ? null
      : err;

    // 去掉额外的反斜线
    if (slashAdded) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }

    // 恢复更改的 req.url
    if (removed.length !== 0) {
      req.baseUrl = parentUrl;
      req.url = protohost + removed + req.url.substr(protohost.length);
      removed = '';
    }

    // 没有更多 layer 匹配
    if (idx >= stack.length) {
      setImmediate(done, layerError);
      return;
    }

    // 获取请求的路径名
    var path = getPathname(req);

    if (path == null) {
      return done(layerError);
    }

    // 寻找下一个匹配的 layer
    var layer;
    var match;
    var route;

    while (match !== true && idx < stack.length) {
      layer = stack[idx++];
      match = matchLayer(layer, path);
      route = layer.route;

      if (typeof match !== 'boolean') {
        // 保持 layerError
        layerError = layerError || match;
      }

      if (match !== true) {
        continue;
      }

      if (!route) {
        // 普通地处理非路由处理器
        continue;
      }

      if (layerError) {
        // 不匹配包含待处理的错误的路由
        match = false;
        continue;
      }

      var method = req.method;
      var has_method = route._handles_method(method);

      // 创建自动的响应选项
      if (!has_method && method === 'OPTIONS') {
        appendMethods(options, route._options());
      }

      // 不影响路由匹配
      if (!has_method && method !== 'HEAD') {
        match = false;
        continue;
      }
    }

    // 没有匹配
    if (match !== true) {
      return done(layerError);
    }

    // 保存路由用于发送变动
    if (route) {
      req.route = route;
    }

    // 捕获一次性 layer 值
    req.params = self.mergeParams
      ? mergeParams(layer.params, parentParams)
      : layer.params;
    var layerPath = layer.path;

    // layer 到这里应该已经搞定了
    self.process_params(layer, paramcalled, req, res, function (err) {
      if (err) {
        return next(layerError || err);
      }

      if (route) {
        return layer.handle_request(req, res, next);
      }

      trim_prefix(layer, layerError, layerPath, path);
    });
  }

  function trim_prefix(layer, layerError, layerPath, path) {
    var c = path[layerPath.length];
    if (c && '/' !== c && '.' !== c) return next(layerError);

     // 切掉 URL 中与路由匹配的部分
     // 中间件（.use 的）也需要切一下路径
    if (layerPath.length !== 0) {
      debug('trim prefix (%s) from url %s', layerPath, req.url);
      removed = layerPath;
      req.url = protohost + req.url.substr(protohost.length + removed.length);

      // 确保开头的反斜线
      if (!fqdn && req.url[0] !== '/') {
        req.url = '/' + req.url;
        slashAdded = true;
      }

      // 设定基 URL (不带反斜线结尾)
      req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
        ? removed.substring(0, removed.length - 1)
        : removed);
    }

    debug('%s %s : %s', layer.name, layerPath, req.originalUrl);

    if (layerError) {
      layer.handle_error(layerError, req, res, next);
    } else {
      layer.handle_request(req, res, next);
    }
  }
};

/**
 * 处理 layer 的所有参数
 * @private
 */

proto.process_params = function process_params(layer, called, req, res, done) {
  var params = this.params;

  // 捕获的 layer 的参数的键值对
  var keys = layer.keys;

  // 没参数的话直接绕过
  if (!keys || keys.length === 0) {
    return done();
  }

  var i = 0;
  var name;
  var paramIndex = 0;
  var key;
  var paramVal;
  var paramCallbacks;
  var paramCalled;

  // 依次处理参数
  // 参数回调函数可以是异步的
  function param(err) {
    if (err) {
      return done(err);
    }

    if (i >= keys.length ) {
      return done();
    }

    paramIndex = 0;
    key = keys[i++];

    if (!key) {
      return done();
    }

    name = key.name;
    paramVal = req.params[name];
    paramCallbacks = params[name];
    paramCalled = called[name];

    if (paramVal === undefined || !paramCallbacks) {
      return param();
    }

    // 同样的参数之前处理过
    // 或者遇到错误
    if (paramCalled && (paramCalled.match === paramVal
      || (paramCalled.error && paramCalled.error !== 'route'))) {
      // 恢复值
      req.params[name] = paramCalled.value;

      // 下一个参数
      return param(paramCalled.error);
    }

    called[name] = paramCalled = {
      error: null,
      match: paramVal,
      value: paramVal
    };

    paramCallback();
  }

  // 单参数回调
  function paramCallback(err) {
    var fn = paramCallbacks[paramIndex++];

    // 保存更新后的值
    paramCalled.value = req.params[key.name];

    if (err) {
      // store error
      paramCalled.error = err;
      param(err);
      return;
    }

    if (!fn) return param();

    try {
      fn(req, res, paramCallback, paramVal, key.name);
    } catch (e) {
      paramCallback(e);
    }
  }

  param();
};

/**
 * 使用给定的中间件函数，可以手动指定路径
 * 默认路径为 `/`
 *
 * use 和 `.all` 类似，对所有 HTTP 方法均有效，
 * 但区别是它不会添加处理器，
 * 所以 OPTIONS 请求即使能够响应也不会考虑 `.use`
 *
 * 另外的区别就是路由的路径被剪切了，
 * 对它的处理器函数也不可见，
 * 这个特性主要用于不依赖路径名前缀的处理器
 *
 * @public
 */

proto.use = function use(fn) {
  var offset = 0;
  var path = '/';

  // 设置默认路径 '/'
  // 消除 router.use([fn]) 的歧义
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

  var callbacks = flatten(slice.call(arguments, offset));

  if (callbacks.length === 0) {
    throw new TypeError('Router.use() requires middleware functions');
  }

  for (var i = 0; i < callbacks.length; i++) {
    var fn = callbacks[i];

    if (typeof fn !== 'function') {
      throw new TypeError('Router.use() requires middleware function but got a ' + gettype(fn));
    }

    // 添加中间件
    debug('use %s %s', path, fn.name || '<anonymous>');

    var layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: false,
      end: false
    }, fn);

    layer.route = undefined;

    this.stack.push(layer);
  }

  return this;
};

/**
 * 为给定的路径创建新的路由
 *
 * 每个路由都包含分离的中间件栈和 VERB（HTTP 动词） 处理器
 *
 * @param {String} path
 * @return {Route}
 * @public
 */

proto.route = function route(path) {
  var route = new Route(path);

  var layer = new Layer(path, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true
  }, route.dispatch.bind(route));

  layer.route = route;

  this.stack.push(layer);
  return route;
};

// 创建 Router#VERB 函数
methods.concat('all').forEach(function(method){
  proto[method] = function(path){
    var route = this.route(path)
    route[method].apply(route, slice.call(arguments, 1));
    return this;
  };
});

// 将附加的方法添加到 methods 列表
function appendMethods(list, addition) {
  for (var i = 0; i < addition.length; i++) {
    var method = addition[i];
    if (list.indexOf(method) === -1) {
      list.push(method);
    }
  }
}

// 获取请求的路径名
function getPathname(req) {
  try {
    return parseUrl(req).pathname;
  } catch (err) {
    return undefined;
  }
}

// 获取错误信息的类型
function gettype(obj) {
  var type = typeof obj;

  if (type !== 'object') {
    return type;
  }

  // 查看对象的 [[Class]]
  return toString.call(obj)
    .replace(objectRegExp, '$1');
}

/**
 * 匹配路径到 layer
 *
 * @param {Layer} layer
 * @param {string} path
 * @private
 */

function matchLayer(layer, path) {
  try {
    return layer.match(path);
  } catch (err) {
    return err;
  }
}

// 合并 params 到 parent
function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params;
  }

  // 为基础对象创建 parent 的副本
  var obj = mixin({}, parent);

  // 简单的非数字合并
  if (!(0 in params) || !(0 in parent)) {
    return mixin(obj, params);
  }

  var i = 0;
  var o = 0;

  // determine numeric gaps
  while (i in params) {
    i++;
  }

  while (o in parent) {
    o++;
  }

  // 合并前参数的索引偏移
  for (i--; i >= 0; i--) {
    params[i + o] = params[i];

    // 创建用于合并的位置
    if (i < o) {
      delete params[i];
    }
  }

  return mixin(obj, params);
}

// 函数处理之后恢复 obj 的属性
function restore(fn, obj) {
  var props = new Array(arguments.length - 2);
  var vals = new Array(arguments.length - 2);

  for (var i = 0; i < props.length; i++) {
    props[i] = arguments[i + 2];
    vals[i] = obj[props[i]];
  }

  return function(err){
    // restore vals
    for (var i = 0; i < props.length; i++) {
      obj[props[i]] = vals[i];
    }

    return fn.apply(this, arguments);
  };
}

// 发送 OPTIONS 响应
function sendOptionsResponse(res, options, next) {
  try {
    var body = options.join(',');
    res.set('Allow', body);
    res.send(body);
  } catch (err) {
    next(err);
  }
}

// 包装到函数中
function wrap(old, fn) {
  return function proxy() {
    var args = new Array(arguments.length + 1);

    args[0] = old;
    for (var i = 0, len = arguments.length; i < len; i++) {
      args[i + 1] = arguments[i];
    }

    fn.apply(this, args);
  };
}
