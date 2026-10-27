const express = require('express')
const pool = require('./config/db')
require('dotenv').config()
const cors = require('cors')  

const app = express()
const port = process.env.PORT || 3500

app.use(express.json())
app.use(cors({                       
  origin: 'http://localhost:3000'
}))

const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);

const userRoutes = require('./routes/userRoutes')
app.use('/api/users', userRoutes)

const inspectorRoutes=require('./routes/inspectorRoutes');
app.use('/api/inspectors', inspectorRoutes);

app.get('/', (req,res) => {
    res.json({ message: "That's Dengue Alert API"})
});

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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})