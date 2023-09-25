const express = require("express");
const ejs = require("ejs");
const path = require("path");
const { format } = require('date-fns-tz');
const cookieParser = require("cookie-parser")
const bodyParser = require("body-parser");
require('dotenv').config();


const app = express();

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());
app.use((req, res, next) => {
    res.locals.lastLocations = req.cookies.dataList === undefined ? [] : JSON.parse(req.cookies.dataList);  
    next();
});


app.get("/", (req, res) => {
    const currentLoc = req.cookies.currentLocation;
    res.locals.currentLocation = currentLoc || null;
    res.render("index");
});


app.post("/search", async (req, res) => {

    const searchedCity = req.body.location;
    const apiKey = process.env.API_KEY;
    const apiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${searchedCity}&limit=3&appid=${apiKey}`;
    try{
        const latLonResult = await fetch(apiUrl)
            .then(data => data.json())
            .catch(error => {
                console.log(error);
            });
        res.render("locationSelect", { data: latLonResult, searchedCity });
    }catch{
        console.log("goicoding failed....")
    }
});


function getCurrentTime(weatherData) {
    let timezoneOffsetInSeconds;
    timezoneOffsetInSeconds = weatherData.timezone;
    const date = new Date();
    const utc_offest = date.getTimezoneOffset();
    date.setMinutes(date.getMinutes() + utc_offest);
    date.setMinutes(date.getMinutes() + timezoneOffsetInSeconds / 60);
    const localTimeFormat = 'h:mm a';
    const localDateFormat = 'EEEE, MMMM dd, yyyy';
    const localTimeFormatted = format(date, localTimeFormat);
    const localDateFormatted = format(date, localDateFormat);
    return { time: localTimeFormatted, date: localDateFormatted };
}


function getTime(unixTimestamp,  timezoneOffsetSeconds) {
    const date = new Date(unixTimestamp * 1000);
    date.setTime(date.getTime() + timezoneOffsetSeconds * 1000);

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = (hours % 12) || 12;   
    console.log(`${hours}:${minutes} ${ampm}`);
    return  `${hours}:${minutes} ${ampm}`;
}

app.get("/search/:lat/:lon", async (req, res) => {

    const { lat, lon } = req.params;
    const apiKey = process.env.API_KEY;
    const weatherApi = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    try{
        const weatherData = await fetch(weatherApi)
            .then(data => data.json())
            .catch(error => {
                console.log(error);
            });
    
        const pollutionApi = `http://api.openweathermap.org/data/2.5/air_pollution/history?lat=${lat}&lon=${lon}&start=${weatherData.sys.sunrise}&end=${weatherData.sys.sunset}&appid=${apiKey}`;
    
        const pollutionData = await fetch(pollutionApi)
            .then(data => data.json())
            .catch(error => {
                console.log(error);
            });
    
        const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const obj = [{ name: weatherData.name, lat: lat, lon: lon, country: weatherData.sys.country }];
        if (req.cookies.dataList === undefined) {
            res.cookie("dataList", JSON.stringify(obj), {
                expires: expiryDate,
                secure: true,
                httpOnly: true,
            });
    
        } else {
            const arr = JSON.parse(req.cookies.dataList);
            let flag = true;
            for(let index of arr){
                if(index.name === obj[0].name){
                    flag = false;
                }
            }
            if(flag===true){
                if (arr.length == 3) {
                    arr.shift();
                }
                arr.push(obj[0]);
                res.cookie("dataList", JSON.stringify(arr), {
                    expires: expiryDate,
                    secure: true,
                    httpOnly: true,
                });
            }
        }
    
        const dateTime = getCurrentTime(weatherData);
        const sunrise = getTime(weatherData.sys.sunrise, weatherData.timezone);
        const sunset = getTime(weatherData.sys.sunset, weatherData.timezone);
        res.render("showWeather", { today : dateTime, weatherData: weatherData, pollutionData : pollutionData.list ,lat, lon, sunrise, sunset });
    }
    catch{
        console.log("select failed...")
    }
});


app.get("/get", (req, res) => {
    res.send(req.cookies.dataList)
})

app.listen(3000, (req, res) => {
    console.log("listening");
});