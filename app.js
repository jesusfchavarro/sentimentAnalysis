const cheerio = require('cheerio');
const fs = require('fs');
const fetchAux = require("node-fetch");

const fetch = url => fetchAux(url).then(res => res.json());
const fetchText = url => fetchAux(url).then(res => res.text());

function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s*1000));
}

const cleanCarrera = carrera => {
  return {
    universidad: carrera.idUniversidad,
    programa: carrera.slug,
    nombre: carrera.nombre
  }
}

const getCarreras = async (universidades) => {
  const carreras = [];
  for (const universidad of universidades) {
    let carrera = await fetch(`https://api.losestudiantes.co/universidades/${universidad}/programas`);
    carreras.push(...carrera)
  }
  return carreras.map(cleanCarrera)
}

const cleanProfesor = profesor => {
  return {
    universidad: profesor.idUniversidad,
    profesor: profesor.slug,
    programa: profesor.departamento.slug,
    nombre: profesor.nombre + ' ' + profesor.apellidos,
    sexo: profesor.sexo
  }
}

const getProferoresCarrera = async carrera => {
  const profesores = []
  const {universidad, programa} = carrera;
  let prof;
  let i = 1;
  do {
    prof = await fetch(`https://api.losestudiantes.co/universidades/${universidad}/programa/${programa}/sample/alfabetico/${36*i}`);
    profesores.push(...prof);
    i++
  } while (prof.length > 0);
  return profesores.map(cleanProfesor)
}

const getProfesores = async carreras => {
  const profesores = []
  for(const carrera of carreras){
    profesores.push(getProferoresCarrera(carrera))
    console.log(carrera.nombre)

  }
  return (await Promise.all(profesores)).flat()
}


const getOpinionesProfesor = async prof => {
  const {universidad, programa, profesor} = prof;
  console.log(profesor)
  const page = await fetchText(`https://losestudiantes.co/${universidad}/${programa}/profesores/${profesor}`);
  const $ = cheerio.load(page);
  const texto = $('.post .calificacion .lineBreak').toArray();

  const calificacion = $('.post .statsProfesor .fa-star').toArray();

  const opiniones = [];

  for(let i in texto){
    opiniones.push({
      opinion: texto[i].children[0].data,
      calificacion: calificacion[i].next.children[0].data
    })
  }

  return opiniones;
}

const getOpiniones = async profesores => {
  const opiniones = [];
  for (const i in profesores) {
    opiniones.push(getOpinionesProfesor(profesores[i]).catch(error => ({'error': true})));
    if (i % 100 === 0) {
      console.log(i);
      //await sleep(1)
      await Promise.all(opiniones)
    }
  }
  return (await Promise.all(opiniones)).flat();
}

(async () => {
  //const carreras = await getCarreras(['universidad-de-los-andes', 'universidad-nacional']);
  //console.dir(carreras[0]);

  //const profesores = await getProfesores(carreras);


  let rawdata = fs.readFileSync('profesores.json');
  let profesores = JSON.parse(rawdata);
  console.table(profesores)

  let data = JSON.stringify(profesores);
  fs.writeFileSync('profesores.json', data);

  let opiniones = await getOpiniones(profesores);

  console.table(opiniones)
  data = JSON.stringify(opiniones);
  fs.writeFileSync('opiniones.json', data);
})();
