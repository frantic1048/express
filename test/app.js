//导入断言模块
var assert = require('assert')
//通过上级菜单的index.js导入lib/express
var express = require('..')
//导入supertest模块
var request = require('supertest')

//'app'测试模块
describe('app', function(){
  //检测express是否继承自event emitter
  it('should inherit from event emitter', function(done){
    //生成express对象app
    var app = express();
    //对事件'foo'设定监听器，若触发'foo'事件，则运行done函数
    app.on('foo', done);
    //发射'foo'事件，若触发done函数则该测试用例通过
    app.emit('foo');
  })

  //检测express是否是可调用的
  it('should be callable', function(){
    var app = express();
    //判断express的类型是不是'function'
    //assert.equal自动执行done
    assert.equal(typeof app, 'function');
  })

  //检测未路由状态下HTTP返回状态码是否是404
  it('should 404 without routes', function(done){
    //用get方式访问一个空地址
    request(express())
    .get('/')
    .expect(404, done);
  })
})

//app.paren测试模块
describe('app.parent', function(){

  it('should return the parent when mounted', function(){
    var app = express()
      , blog = express()
      , blogAdmin = express();

    //将中间件blog挂载到'/blog'路径
    app.use('/blog', blog);
    //将中间件blogAdmin挂载到'/admin'路径
    blog.use('/admin', blogAdmin);

    //等同于assert.equal(!app.parent, true, 'app.parent')
    //若app.parent不存在，则测试通过
    assert(!app.parent, 'app.parent');
    //若blog.parent为app，则测试通过
    blog.parent.should.equal(app);
    //blogAdmin.parent为blog，则测试通过
    blogAdmin.parent.should.equal(blog);
  })
})

//app.mountpath测试模块
describe('app.mountpath', function(){
  //检测是否返回正常的mountpath
  it('should return the mounted path', function(){
    var admin = express();
    var app = express();
    var blog = express();
    var fallback = express();

    app.use('/blog', blog);
    app.use(fallback);
    blog.use('/admin', admin);

    //mountpath类似于baseUrl，即返回其对应的路径
    //若以下对应mountpath与后值相等，则测试通过
    admin.mountpath.should.equal('/admin');
    app.mountpath.should.equal('/');
    blog.mountpath.should.equal('/blog');
    fallback.mountpath.should.equal('/');
  })
})

//app.router测试模块
describe('app.router', function(){
  //检测是否正常报错
  it('should throw with notice', function(done){

    var app = express();
    //此处app尚未添加router组件，throw出错误即通过测试
    try {
      app.router;
    } catch(err) {
      done();
    }
  })
})

//app.path()函数测试模块
describe('app.path()', function(){
  //应当返回规范路径
  it('should return the canonical', function(){
    var app = express()
      , blog = express()
      , blogAdmin = express();

    app.use('/blog', blog);
    blog.use('/admin', blogAdmin);

    //app对应路径应为'/'
    app.path().should.equal('');
    //blog对应路径应为'/blog'
    blog.path().should.equal('/blog');
    //blogAdmin对应路径应为'/blog/admin'
    blogAdmin.path().should.equal('/blog/admin');
  })
})

//development环境测试模块
describe('in development', function(){
  it('should disable "view cache"', function(){
    //通过修改环境变量转换成development环境
    process.env.NODE_ENV = 'development';
    var app = express();
    //development环境应该不可以查看缓存
    app.enabled('view cache').should.be.false;
    //通过修改环境变量改回test环境
    process.env.NODE_ENV = 'test';
  })
})

//使用环境测试模块
describe('in production', function(){
  it('should enable "view cache"', function(){
    //通过修改环境变量转换成production环境
    process.env.NODE_ENV = 'production';
    var app = express();
    //production环境应该可以查看缓存
    app.enabled('view cache').should.be.true;
    //通过修改环境变量改回test环境
    process.env.NODE_ENV = 'test';
  })
})

//检测默认环境
describe('without NODE_ENV', function(){
  //默认环境应该为development
  it('should default to development', function(){
    //将环境变量置为空置
    process.env.NODE_ENV = '';
    var app = express();
    //环境变量置为空置时的默认值应该为development
    app.get('env').should.equal('development');
    //通过修改环境变量改回test环境
    process.env.NODE_ENV = 'test';
  })
})
