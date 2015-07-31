var sem = require("/MarkLogic/semantics.xqy");
var ss = require("/MarkLogic/appservices/search/search.xqy");

var config = require('lib/config.sjs');
var view = require('lib/view.sjs');

var _ = require('lib/js/lodash.min.sjs');

var serialization = xdmp.getRequestField("serialization");
if (serialization instanceof Array) {
    serialization = serialization[0];
}

var graph = xdmp.getRequestField("graph");
/*
    graph = typeof graph;
    graph will be "string" if there is one
    graph will be instanceof Array if there are multple
    graph will be 'object' if empty
*/
if (graph instanceof Array) {
    graph = graph[0];
} else if ( typeof graph === "object") {
    graph = "";
}

var qs = xdmp.getRequestField("q");
if (qs instanceof Array) {
    q = qs.join(" AND ");
} else if ( typeof qs === "object") {
    q = "";
} else {
    q = qs;
}

var parsed = ss.parse(q);
var qtype = "AND";
var qstrings = [];

for (var p of parsed.xpath("/*")) {
    if (p.localname === "or-query") {
        qtype = "OR";
        for (var t of parsed.xpath("/*:or-query//*:text/text()")) {    
            qstrings.push(t);
        }
    } else {
        for (var t of parsed.xpath("//*:text/text()")) {    
            qstrings.push(t);
        }
    }
}

var qlines = [];
if (qtype === "OR") {
     qstrings.forEach(function (value, i) {
        var qline = "?s ?p ?q ."
        var qobj = 
            {
                "q": value,
                "qline": qline
            }
        qlines.push(qobj);
    });   
} else {
    qstrings.forEach(function (value, i) {
        var qline = "?s ?p" + i + " ?q" + i + " .";
        var qobj = 
            {
                "q": value,
                "qline": qline
            }
        qlines.push(qobj);
    }); 
}


var includeBnodes = xdmp.getRequestField("includeBnodes");
if (includeBnodes === 1 || includeBnodes === "true" || includeBnodes === "1") {
    includeBnodes = true;
} else {
    includeBnodes = false;
}

var prefixes = {
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#": "rdf",
            "http://www.w3.org/2000/01/rdf-schema#": "rdfs",
            "http://www.w3.org/2002/07/owl#": "owl",
            "http://www.w3.org/2004/02/skos/core#": "skos",
            "http://purl.org/dc/terms/": "dcterms",
            "http://purl.org/dc/elements/1.1/": "dc",
            "http://marklogic.com/semantics#": "semantics",
            "http://marklogic.com/cts#": "cts"
        }
        
var propSortOrder = {
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": 1,
        "http://www.w3.org/2000/01/rdf-schema#label": 2,
        "http://www.w3.org/2004/02/skos/core#prefLabel": 3,
        "http://www.w3.org/2004/02/skos/core#altLabel": 4,
        "http://www.w3.org/2000/01/rdf-schema#subClassOf": 5,
        "http://www.w3.org/2000/01/rdf-schema#subPropertyOf": 5,
        "http://www.w3.org/2000/01/rdf-schema#comment": 6,
        "http://www.w3.org/2004/02/skos/core#definition": 6,
        "http://www.w3.org/2000/01/rdf-schema#domain": 7,
        "http://www.w3.org/2004/02/skos/core#broader": 7,
        "http://www.w3.org/2000/01/rdf-schema#range": 8,
        "http://www.w3.org/2004/02/skos/core#narrower": 8
    }
        
var sparqlPrefixes = '';
for (var k in prefixes) {
    sparqlPrefixes += "PREFIX " + prefixes[k] + ": <" + k + "> \n";
}

function readableResource(rstr) {
    if (rstr.indexOf("#") > 1) {
        npos = rstr.lastIndexOf('#');
    } else {
        npos = rstr.lastIndexOf('/');
    }
    prefix = rstr.substring(0, npos + 1);
    name = rstr.substring(npos + 1);
    if (prefixes[prefix] !== undefined) {
        return prefixes[prefix] + ":" + name;
    } else {
        // Prefix is not recognized. So let's put something together.
        var ns = rstr.substring(0, npos);
        var pos = ns.lastIndexOf('/');
        var p = ns.substring(pos + 1);
        return p + ":" + name;
    }
}

function parseSparqlResults(sparqlresults, urivar) {
    var results = [];
    for (var r of sparqlresults) {
        var result = objectifySparqlResult(r, urivar, {});
        results.push(result);
    }
    return results;
}

function objectifySparqlResult(r, urivar, baseObject) {
    var result = baseObject;
    for (var k in r) {
        result[k] = r[k];
    }
    var rstr = String(result[urivar]);
    result.readableProperty = readableResource(rstr);
    return result;
}

// All the graphs
var onlyIris = 'FILTER( isIRI(?s) ) .';
if (includeBnodes) {
    onlyIris = '';
}
var sparqlQuery = '';
if (graph !== "") {
    sparqlQuery = ' \
        ' + sparqlPrefixes + ' \
        SELECT DISTINCT ?s \
        WHERE { \
            GRAPH $graph { \
                ?s ?p ?o . \
                FILTER( cts:contains(?o, cts:word-query($q, "case-insensitive")) ) . \
                ' + onlyIris + ' \
            } \
        } \
    ';
} else {
    sparqlQuery = ' \
        ' + sparqlPrefixes + ' \
        SELECT DISTINCT ?s \
        WHERE { \
            ?s ?p ?o . \
            FILTER( cts:contains(?o, cts:word-query($q, "case-insensitive")) ) . \
            ' + onlyIris + ' \
        } \
    ';
}
var bindings = {
    "q": q,
    "graph": graph
}
var hits = sem.sparql(sparqlQuery, bindings);

var triples = [];
for (var h of hits) {
    var sparqlQuery = ' \
        ' + sparqlPrefixes + ' \
        SELECT DISTINCT * \
        WHERE { \
            $s ?p ?o . \
            OPTIONAL { \
                ?o rdfs:label|skos:prefLabel ?label . \
            } . \
        } \
    ';
    var bindings = {
        "s": h.s
        }
    var sparqlresults = sem.sparql(sparqlQuery, bindings);
    for (var r of sparqlresults) {
        var baseObject = {
                "s": String(h.s)
            }
        var result = objectifySparqlResult(r, "p", baseObject);
        triples.push(result);
    }
}

var resources = 
    _.chain(triples)
    .groupBy("s")
    .pairs()
    .map(function (currentItem) {
        return _.object(_.zip(["s", "triples"], currentItem));
    })
    .value();

_.each(resources, function(r) {
    _.each(r.triples, function(t) {
        if (propSortOrder[t.p] !== undefined) {
            t.sortPosition = propSortOrder[t.p];
        } else {
            t.sortPosition = 200;
        }
    });
    r.triples = _.sortBy(r.triples, "sortPosition");
});

var results = {
    "query": q,
    "includeBnodes": includeBnodes,
    "elapsedTime": xdmp.elapsedTime(),
    "count": resources.length,
    "hits": resources
}

var pagedata =
    {
        "pageTitle": "Search",
        "results": results
    };

if (serialization === "json") {
    xdmp.setResponseContentType("application/json");
    //pagedata;
    pagedata;
} else if (serialization === "xml") {
    xdmp.setResponseContentType("application/xml");
    //pagedata;
    parsed;
} else {
    var html = view.page("templates/search.jade", pagedata);
    xdmp.setResponseContentType("text/html");
    html;
}
