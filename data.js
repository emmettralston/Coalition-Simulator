// data.js allows easy editing of party and portfolio data for different version (non GOT)

// Constants shared across app for refrencing 
const TOTAL_SEATS = 200;
const MAJORITY = 101; // seats required for majority

// Party seat counts and policy values (-5 to +5)
const HOUSES = [
  { id:"Targaryen", seats:44, x:+4 },
  { id:"Lannister", seats:36, x:+2 },
  { id:"Stark", seats:30, x:-3 },
  { id:"Baratheon", seats:22, x:+1 },
  { id:"Greyjoy", seats:12, x:-5 },
  { id:"Tyrell", seats:20, x:+1 },
  { id:"Martell", seats:14, x:-2 },
  { id:"Arryn", seats:10, x:+1 },
  { id:"Tully", seats:12, x:-1 }
];

// Cabinet positions
const PORTFOLIOS = [
  "Hand of the King/Queen",
  "Master of Coin",
  "Grand Maester",
  "Master of Laws",
  "Master of Ships",
  "Master of Whisperers",
  "Lord Commander of the Kingsguard"
];
