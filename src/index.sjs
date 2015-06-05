var sem = require("/MarkLogic/semantics.xqy");
var view = require('lib/view.sjs');

var serialization = xdmp.getRequestField("serialization");
if (serialization instanceof Array) {
    serialization = serialization[0]
}

var prefixes = {
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#": "rdf",
            "http://www.w3.org/2000/01/rdf-schema#": "rdfs",
            "http://www.w3.org/2002/07/owl#": "owl",
            "http://www.w3.org/2004/02/skos/core#": "skos",
            "http://purl.org/dc/terms/": "dcterms",
            "http://purl.org/dc/elements/1.1/": "dc"
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
        // Prefix is not recognized.
        var ns = rstr.substring(0, npos);
        var pos = ns.lastIndexOf('/');
        var p = ns.substring(pos + 1);
        return p + ":" + name;
    }
}

function parseSparqlResults(sparqlresults, urivar) {
    var results = [];
    for (var r of sparqlresults) {
        var result = {};
        for (var k in r) {
            result[k] = r[k];
        }
        var rstr = String(result[urivar]);
        result.readableType = readableResource(rstr);
        results.push(result);
    }
    return results;
}


// All the types
var sparqlQuery = ' \
    ' + sparqlPrefixes + ' \
    SELECT ?type ?label (COUNT(?instance) AS ?count) \
    WHERE { \
        ?instance a ?type . \
        OPTIONAL { \
            ?type rdfs:label|skos:prefLabel ?label . \
        } \
    } \
    GROUP BY ?type \
    ORDER BY DESC(?count) \
    ';
var sparqltypes = sem.sparql(sparqlQuery);
var types = parseSparqlResults(sparqltypes, "type")

// All the properties
var sparqlQuery = ' \
    ' + sparqlPrefixes + ' \
    SELECT ?property ?label (COUNT(?property) AS ?count) \
    WHERE { \
        ?s ?property ?o . \
        OPTIONAL { \
            ?property rdfs:label ?label . \
        } \
    } \
    GROUP BY ?property \
    ORDER BY DESC(?count) \
    ';
var sparqlproperties = sem.sparql(sparqlQuery);
var properties = parseSparqlResults(sparqlproperties, "property")

// Top level classes
var sparqlQuery = ' \
    ' + sparqlPrefixes + ' \
    SELECT ?s ?label \
    WHERE { \
        ?s ?p ?o . \
        OPTIONAL { ?s rdfs:subClassOf ?o } . \
        FILTER (!BOUND(?o)) . \
        OPTIONAL { \
            ?s rdfs:label ?label . \
        } \
    } \
    ';
var sparqltopclasses = sem.sparql(sparqlQuery);
var topclasses = parseSparqlResults(sparqltopclasses, "s")

/*
    ML 8 does not support negation - period - presently 
    so this is not possible:
    # Top-level classes?
    # SELECT *
    # WHERE {
    #  ?s ?p ?o .
      # FILTER NOT EXISTS { ?s <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o }
    #  OPTIONAL { ?s <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o } .
    #  FILTER (!BOUND(?o)) .
    #}
    We have to do this the hard way.
*/
// All distinct classes that have subclasses
var sparqlQuery = ' \
    ' + sparqlPrefixes + ' \
    SELECT DISTINCT ?s \
    WHERE { \
        ?s <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o . \
        FILTER ( isIRI(?s) ) . \
    } \
    ';
var sparqlsubclasses = sem.sparql(sparqlQuery);
var subclasses = [];
for (var r of sparqlsubclasses) {
    subclasses.push(String(r.s));
}

// All distinct resources declared an owl:Class or rdfs:Class
var sparqlQuery = ' \
    ' + sparqlPrefixes + ' \
    SELECT DISTINCT ?s ?label \
    WHERE { \
        { \
            ?s rdf:type owl:Class . \
        } UNION { \
            ?s rdf:type rdfs:Class . \
        } \
        FILTER ( isIRI(?s) ) . \
        OPTIONAL { \
            ?s rdfs:label ?label . \
        } \
    } \
    ';
var sparqlclasses = sem.sparql(sparqlQuery);
var topclasses = [];
for (var r of sparqlclasses) {
    var test = String(r.s);
    if ( subclasses.indexOf(test) === -1 ) {
        var tc = {};
        tc.class = String(r.s);
        tc.label = r.label;

        var rstr = String(r.s);
        tc.readableType = readableResource(rstr);
        
        topclasses.push(tc);    
    }
}



var pagedata =
    {
        "types": types,
        "properties": properties,
        "topclasses": topclasses
    };

if (serialization === "json") {
    xdmp.setResponseContentType("application/json");
    pagedata
} else {
    var html = view.page("templates/index.jade", pagedata);
    xdmp.setResponseContentType("text/html");
    html;    
}
