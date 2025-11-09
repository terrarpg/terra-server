
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use('/files', express.static(path.join(__dirname, 'files')));

app.get('/', (req,res)=>res.send('Terra File Server OK'));

app.listen(port, ()=>console.log(`Server running on http://localhost:${port}`));
