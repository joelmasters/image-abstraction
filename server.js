// Image search abstraction layer
// Requests in the form of /<search term>?offset=<page offset>
// Return:
// {
//   image url:
//   alt text: 
//   page url:
// }

var fs = require('fs');
var express = require('express');
var app = express();
var https = require('https');
var mongo = require('mongodb').MongoClient;
var url = process.env.MONGOLAB_URL;

// set express server
app.set('json spaces', 2);
app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.use('/list', function(req, res) {
  mongo.connect(url, function(err, db) {
    if (err) throw err;
    var myDB = db.db('url-shortener');
    var collection = myDB.collection('images');
    
    collection.find().toArray(function(err, docs) {
      if (err) throw err;
      db.close();
      res.send(docs); 
    });
    
  });
});

// this prevents favicon.ico request from populating in database
app.use('/favicon.ico', function(req, res) {
  // do nothing but log that favicon was sent
  console.log('favicon sent');
  res.end();
});

app.use('/', function(req, res) {
  var inputURL = req.path.slice(1);
  var searchTerm = inputURL.split('?')[0];

  searchTerm = searchTerm.replace('%20', ' ');
  var offset = inputURL.split('?offset=')[1];
  
  const options = {
    protocol: 'https:',
    hostname: 'api.imgur.com',
    path: '/3/gallery/search/time/all/' + offset + '?q=' + searchTerm,
    headers: {
        'Authorization': 'Client-ID 2617d18ea554f54'
      }
  };
  
  https.get(options, function(response) {
    var buffer = "";
    var data = "";
    var route = "";
    
    response.on('data', function(chunk) {
      buffer += chunk;
    });
    
    response.on('end', function(err) {
      if (err) throw err;
      
      data = JSON.parse(buffer);
      var dataTitles = [];
      
      for (var obj in data["data"]) {
        dataTitles.push({
          "title" : data["data"][obj]["title"],
          "link" : data["data"][obj]["link"],
          "views" : data["data"][obj]["views"],
          "id" : data["data"][obj]["id"]
        });
        if (dataTitles.length == 10) {
          break;
        }
      }
      
      // connect to the external database
      mongo.connect(url, function(err, db) {
        if (err) throw err;
        
        var myDB = db.db('url-shortener');
        
        // store docs in images collection
        var collection = myDB.collection('images');
        
        // add the search term to the database in images collection
        collection.insertOne({search: searchTerm}).then(function(data) {
          db.close();
          // send the reponse back to the page
          res.send(dataTitles);
          // close and disconnect from the database
          
        });
        
      });
      
    });
    
  });

});

const listener = app.listen(process.env.PORT, () => {
   console.log(`Your app is listening on port ${listener.address().port}`)
});
