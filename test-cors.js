fetch('https://extendsclass.com/api/json-storage/bin/eeeddfe')
  .then(res => {
    console.log('CORS headers:');
    res.headers.forEach((val, key) => console.log(key, val));
  })
  .catch(console.error);
