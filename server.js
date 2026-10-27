const express = require('express')
const pool = require('./config/db')
require('dotenv').config()
const cors = require('cors')  

const app = express()
const port = process.env.PORT || 3500

app.use(express.json())
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.0.104:3000']
}))

const reportRoutes = require('./routes/reportRoutes')
app.use('/api/reports', reportRoutes);

const userRoutes = require('./routes/userRoutes')
app.use('/api/users', userRoutes)

const inspectorRoutes=require('./routes/inspectorRoutes')
app.use('/api/inspectors', inspectorRoutes);

const hotspotRoutes = require('./routes/hotspotRoutes');
app.use('/api/hotspots', hotspotRoutes);

const magistrateAlertRoutes = require('./routes/magistrateAlertRoutes')
app.use('/api/magistrate-notify', magistrateAlertRoutes)

// app.get('/', (req,res) => {
//     res.json({ message: "That's Dengue Alert API"})
// });

app.get('/api/test-db', async(req,res) => {
    try{
        const result = await pool.query('SELECT NOW()')

        res.status(200).json({
            success: true,
            message: "Database coonected with the API",
            database_time: result.rows[0].now
        });
    }catch(error){
        console.error("Database Error: ", error.message)
        res.status(500).json({
            success: false, 
            message: "Database didn't connect"
        })
    }

})

const path = require('path');

const frontendBuild = path.join(
  __dirname, '..', 'dengue-frontend-fixed-c3', 'build'
);

// Do not cache or leak one-time email verification tokens in referrers.
app.use('/verify-email', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// The tokenized magistrate view contains sensitive complaint details.
// Do not cache the page or send its URL (including token) as a referrer.
app.use('/magistrate-alert', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.use(express.static(frontendBuild));

app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})