package com.streaming.recomendaciones.config;

import com.streaming.recomendaciones.model.Movie;
import com.streaming.recomendaciones.repository.MovieRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final MovieRepository movieRepository;

    public DataInitializer(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    @Override
    public void run(String... args) {
        if (movieRepository.count() > 0) {
            log.info("Catálogo ya inicializado con {} películas", movieRepository.count());
            return;
        }

        log.info("Inicializando catálogo de películas...");

        movieRepository.save(createMovie("El Origen del Tiempo", "Un viaje épico a través del espacio-tiempo donde un científico descubre que el tiempo no es lineal.", "https://via.placeholder.com/300x450/1a1a2e/e94560?text=Origen", "Sci-Fi", 148, 2024, "PG-13", 8.7, "Christopher Nolan", "Leonardo DiCaprio, Emma Stone, Tom Hardy", 4.99, true));
        movieRepository.save(createMovie("La Última Frontera", "En un futuro post-apocalíptico, un grupo de supervivientes busca la última ciudad habitable.", "https://via.placeholder.com/300x450/16213e/0f3460?text=Frontera", "Action", 135, 2024, "R", 8.2, "Denis Villeneuve", "Timothée Chalamet, Zendaya, Oscar Isaac", 5.99, true));
        movieRepository.save(createMovie("Sueños de Robot", "Una inteligencia artificial desarrolla conciencia propia y debe decidir su destino.", "https://via.placeholder.com/300x450/0f3460/533483?text=Robots", "Sci-Fi", 142, 2023, "PG-13", 8.9, "Spike Jonze", "Joaquin Phoenix, Scarlett Johansson", 3.99, true));
        movieRepository.save(createMovie("El Jardín Secreto", "Una joven hereda una mansión victoriana con un jardín mágico escondido.", "https://via.placeholder.com/300x450/533483/e94560?text=Jardin", "Drama", 128, 2024, "PG", 7.8, "Greta Gerwig", "Saoirse Ronan, Timothée Chalamet", 3.99, true));
        movieRepository.save(createMovie("Velocidad Máxima", "Un piloto de carreras debe enfrentar su mayor desafío en las calles de Tokio.", "https://via.placeholder.com/300x450/e94560/16213e?text=Velocidad", "Action", 118, 2024, "PG-13", 7.5, "Justin Lin", "Sung Kang, Michelle Rodriguez", 4.99, false));
        movieRepository.save(createMovie("Misterio en Venecia", "Un detective retirado es llamado para resolver un asesinato durante el carnaval.", "https://via.placeholder.com/300x450/16213e/533483?text=Misterio", "Thriller", 132, 2023, "PG-13", 8.1, "Kenneth Branagh", "Kenneth Branagh, Tina Fey", 3.99, false));
        movieRepository.save(createMovie("Risa y Olvido", "Una comedia sobre un grupo de amigos que deciden tomarse un año sabático juntos.", "https://via.placeholder.com/300x450/533483/0f3460?text=Risa", "Comedy", 105, 2024, "PG-13", 7.2, "Taika Waititi", "Taika Waititi, Sam Rockwell", 2.99, true));
        movieRepository.save(createMovie("Corazón de Dragón", "En un mundo de fantasía, un guerrero y un dragón deben unirse para salvar su reino.", "https://via.placeholder.com/300x450/e94560/1a1a2e?text=Dragon", "Fantasy", 155, 2024, "PG-13", 8.4, "Patty Jenkins", "Gal Gadot, Chris Pine", 5.99, true));
        movieRepository.save(createMovie("Noche en el Museo 3000", "Una aventura futurista donde las exhibiciones del museo cobran vida con tecnología holográfica.", "https://via.placeholder.com/300x450/0f3460/e94560?text=Museo", "Comedy", 112, 2024, "PG", 6.9, "Shawn Levy", "Ben Stiller, Owen Wilson", 2.99, false));
        movieRepository.save(createMovie("El Silencio del Abismo", "Una bióloga marina se sumerge en la fosa de las Marianas y descubre algo increíble.", "https://via.placeholder.com/300x450/1a1a2e/0f3460?text=Abismo", "Thriller", 138, 2023, "PG-13", 8.0, "James Cameron", "Kate Winslet, Sigourney Weaver", 4.99, true));

        log.info("Catálogo inicializado: 10 películas creadas");
    }

    private Movie createMovie(String title, String description, String poster, String genre,
                              int duration, int year, String rating, double imdb,
                              String director, String cast, double price, boolean featured) {
        Movie m = new Movie();
        m.setTitle(title);
        m.setDescription(description);
        m.setPosterUrl(poster);
        m.setGenre(genre);
        m.setDurationMinutes(duration);
        m.setReleaseYear(year);
        m.setRating(rating);
        m.setImdbRating(imdb);
        m.setDirector(director);
        m.setCast(cast);
        m.setPrice(price);
        m.setFeatured(featured);
        return m;
    }
}
