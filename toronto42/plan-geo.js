/* Coordinates for the plan's route stops and GO stations (Google Places, September 19, 2026).
   Used by route.html and the Route Portal's "Plan routes" panel. */
window.PLAN_GEO={
  stations:{
    'Clarkson GO, Mississauga':{lat:43.5137184,lng:-79.6336026,short:'Clarkson GO'},
    'Union Station, Toronto':{lat:43.6453992,lng:-79.3798073,short:'Union'},
    'Port Credit GO, Mississauga':{lat:43.5559786,lng:-79.5868783,short:'Port Credit GO'},
    'Oakville GO, Oakville':{lat:43.4555638,lng:-79.6822651,short:'Oakville GO'},
    'Exhibition GO, Toronto':{lat:43.6358813,lng:-79.4187599,short:'Exhibition GO'}
  },
  /* Minutes by train from Clarkson and which direction the train runs. Off-peak departures from Clarkson:
     eastbound :08 / :38 (arrive Union :45 / :15); westbound :23 / :53. Verify in the GO planner. */
  rail:{
    'Union Station, Toronto':{minutes:37,dir:'east'},
    'Port Credit GO, Mississauga':{minutes:6,dir:'east'},
    'Exhibition GO, Toronto':{minutes:28,dir:'east'},
    'Oakville GO, Oakville':{minutes:7,dir:'west'}
  },
  stops:{
    C06:{lat:43.6463693,lng:-79.3786192},
    N41:{lat:43.651275,lng:-79.3790574},
    N30:{lat:43.6432,lng:-79.39696},
    N03:{lat:43.6495374,lng:-79.3817104},
    C01:{lat:43.6460303,lng:-79.381388},
    C02:{lat:43.6511953,lng:-79.3842566},
    N15:{lat:43.6495696,lng:-79.3800695},
    N01:{lat:43.5527182,lng:-79.5847373},
    N12:{lat:43.5460339,lng:-79.5909054},
    C33:{lat:43.5503814,lng:-79.5843562},
    N11:{lat:43.4441551,lng:-79.6695674},
    C21:{lat:43.4440387,lng:-79.6818665},
    N02:{lat:43.4461957,lng:-79.6673113},
    C08:{lat:43.630981,lng:-79.426217},
    C10:{lat:43.6341781,lng:-79.4106064}
  }
};
