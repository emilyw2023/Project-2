for(let i = 0; i < movies.length; i++) {
    let movie = movies[i]
    makeMovie(movie)
}

function makeMovie(movie) {
    let moviesSection = document.querySelector("#movies")
    let genres = movie.genres
    let newMovie = document.createElement("div")
    let genreList = document.createElement("p")
    

    newMovie.classList.add("card")
    newMovie.innerHTML = `
            <h2>${movie.title}</h2>
            <span>${movie.minutes} min</span>
            <div>
                <img src="${movie.path}" />
            </div>
    `
    genreList.classList.add("genres")
    for(let j = 0; j < genres.length; j++) {
        genreList.innerHTML += `<span>${genres[j]}</span>`
    }
    newMovie.appendChild(genreList)

    // if rated is PG
    if (movie.rated === "PG") {
        // newMovie.classList.add("pg")
        newMovie.style.background = "pink"
    }

    // if rated is R AND minutes longer than 60
    if (movie.rated === "R" && movie.minutes > 60) {
        // newMovie.style.display = "none"
    }

    // if rated IS NOT R
    if (movie.rated !== "R") {
        newMovie.innerHTML += "<p>✅</p>"
    }

    // if genre has thriller OR action
    if (genres.includes("Thriller") || genres.includes("Action")) {
        newMovie.innerHTML += "<p>😱</p>"
    }

    moviesSection.appendChild(newMovie)
}