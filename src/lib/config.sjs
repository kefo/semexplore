var config = {};

config.prefixes = 
    {
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#": "rdf",
        "http://www.w3.org/2000/01/rdf-schema#": "rdfs",
        "http://www.w3.org/2002/07/owl#": "owl",
        "http://www.w3.org/2004/02/skos/core#": "skos",
        "http://purl.org/dc/terms/": "dcterms",
        "http://purl.org/dc/elements/1.1/": "dc",
        "http://marklogic.com/semantics#": "semantics",
        "http://marklogic.com/cts#": "cts"
    }

config.sparqlPrefixes = function() {
    var sparqlPrefixes = '';
    for (var k in this.prefixes) {
        sparqlPrefixes += "PREFIX " + prefixes[k] + ": <" + k + "> \n";
    }
    return sparqlPrefixes;
}

module.exports = view;