const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors()); // allow the frontend to call the API
app.use(express.json()); // read JSON data sent in requests

// All our endpoints start with /api
app.use('/api', routes);

// If no route matched -> 404, and any error -> error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
