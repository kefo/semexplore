var jade = require('/lib/js/jade.sjs');

var view = {};

var headview = xdmp.invoke("templates/head.jade");
var menuview = xdmp.invoke("templates/menu.jade");
var layoutview = xdmp.invoke("templates/layout.jade");

view.setoptions = function(pagedata) {
    pagedata.pretty = 1;
    return pagedata;
}

view.head = function(pagedata) {
    pagedata = this.setoptions(pagedata);
    return jade.render(headview, pagedata);
}

view.menu = function(pagedata) {
    pagedata = this.setoptions(pagedata);
    return jade.render(menuview, pagedata);
}

view.page = function(template, pagedata) {
    pagedata = this.setoptions(pagedata);
    var t = xdmp.invoke(template);
    var body = jade.render(t, pagedata);  
    
    pagedata = 
        {
            "head": view.head(pagedata),
            "menu": view.menu(pagedata),
            "body": body
        };
    pagedata = this.setoptions(pagedata);
    
    return jade.render(layoutview, pagedata); 
  
}

module.exports = view;