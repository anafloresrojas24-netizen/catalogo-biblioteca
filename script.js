
"use strict";

// ==========================================
// CONFIGURACIÓN
// ==========================================
const USUARIO_ADMIN = "admin";
const CONTRASENA_ADMIN = "1234";
const NUMERO_DISPONIBILIDAD = "81 2020 9237";

const LIMITE_LIBROS_PRINCIPAL = 100;
const LIMITE_RESULTADOS_ADMIN = 5;

const ventanaLibro = document.getElementById("ventana-libro");
const ventanaLogin = document.getElementById("ventana-login");
const ventanaAdmin = document.getElementById("ventana-admin");
const ventanaSolicitudes = document.getElementById("ventana-solicitudes");
const catalogo = document.getElementById("catalogo");
const sinResultados = document.getElementById("sin-resultados");

let libros = [];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}

// Calcula el rango de clasificación usando el ID del libro.
function detectarTema(idLibro) {
    const numero = Number(idLibro);

    if (!Number.isFinite(numero) || numero < 0) {
        return "";
    }

    const inicio = Math.floor(numero / 100) * 100;
    const fin = inicio + 99;

    return `${inicio}-${fin}`;
}

function obtenerTema(libro) {
    return libro.clasificacion || "";
}

// ==========================================
// CARGAR LIBROS DESDE MYSQL
// ==========================================
async function cargarLibrosDesdeBD() {
    try {
        const respuesta = await fetch("/api/libros");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los libros desde MySQL.");
        }

        const registros = await respuesta.json();

        libros = registros.map(registro => {
            const numeroSerie =
                String(registro.Clasificacion ?? "").trim();

            const anio =
                String(registro.Anio ?? "").trim();

            return {
                id: registro.ID,

                titulo: String(
                    registro.Titulo ?? "Título no disponible"
                ),

                autor: String(
                    registro.Autores ?? "Autor no disponible"
                ),

                // La materia queda vacía.
                materia: "",

                // El número de serie es el código bibliográfico
                // original guardado en la columna Clasificacion.
                serie: numeroSerie,

                // La clasificación se calcula usando el ID.
                clasificacion: detectarTema(registro.ID),

                imagen: "https://placehold.co/300x420?text=Libro",

                descripcion: anio
                    ? `Año de publicación: ${anio}`
                    : "Año de publicación no especificado"
            };
        });

        mostrarLibros();

    } catch (error) {
        console.error("Error al cargar libros:", error);

        catalogo.innerHTML = "";
        sinResultados.style.display = "block";

        sinResultados.textContent =
            "No se pudieron cargar los libros. Verifica que MySQL y el servidor estén iniciados.";
    }
}

// ==========================================
// MOSTRAR CATÁLOGO
// ==========================================
function mostrarLibros(lista = libros) {
    catalogo.innerHTML = "";

    if (!lista.length) {
        sinResultados.style.display = "block";
        sinResultados.textContent = "No se encontraron libros.";
        return;
    }

    sinResultados.style.display = "none";

    lista.slice(0, LIMITE_LIBROS_PRINCIPAL).forEach(libro => {
        const indice = libros.indexOf(libro);
        const article = document.createElement("article");

        article.className = "libro";

        article.innerHTML = `
            <img
                src="${escaparHTML(libro.imagen)}"
                alt="${escaparHTML(libro.titulo)}">

            <div class="datos-libro">
                <h3>${escaparHTML(libro.titulo)}</h3>

                <p class="numero-serie">
                    <strong>Número de serie:</strong>
                    ${escaparHTML(libro.serie)}
                </p>

                <p>
                    <strong>Autor:</strong>
                    ${escaparHTML(libro.autor)}
                </p>

                <p>
                    <strong>Materia:</strong>
                </p>

                <p>
                    <strong>Clasificación:</strong>
                    ${escaparHTML(libro.clasificacion)}
                </p>

                <p class="contacto-disponibilidad">
                    Contacta al siguiente número para ver la disponibilidad:
                    <strong>${NUMERO_DISPONIBILIDAD}</strong>
                </p>

                <p class="descripcion">
                    ${escaparHTML(libro.descripcion)}
                </p>
            </div>
        `;

        const imagen = article.querySelector("img");

        imagen.onerror = () => {
            imagen.onerror = null;
            imagen.src = "https://placehold.co/300x420?text=Libro";
        };

        article.addEventListener("click", () => abrirLibro(indice));

        catalogo.appendChild(article);
    });
}

// ==========================================
// FILTROS Y BUSCADOR
// ==========================================
function filtrarTema(tema) {
    document.getElementById("buscador").value = "";

    mostrarLibros(
        libros.filter(libro => obtenerTema(libro) === tema)
    );
}

function mostrarTodos() {
    document.getElementById("buscador").value = "";
    mostrarLibros();
}

function buscarLibro() {
    const texto = document.getElementById("buscador")
        .value.toLowerCase().trim();

    if (!texto) {
        mostrarLibros();
        return;
    }

    const resultados = libros.filter(libro => {
        const datos = [
            libro.titulo,
            libro.autor,
            libro.materia,
            libro.serie,
            libro.clasificacion,
            libro.id
        ];

        return datos.some(valor =>
            String(valor ?? "").toLowerCase().includes(texto)
        );
    });

    mostrarLibros(resultados);
}

// ==========================================
// DETALLES DEL LIBRO
// ==========================================

function abrirLibro(indice) {
    const libro = libros[indice];

    if (!libro) return;

    // Registrar que el usuario abrió este libro
    fetch(`/api/libros/${libro.id}/busqueda`, {
        method: "POST"
    }).catch(error => {
        console.error("Error al registrar búsqueda:", error);
    });


    document.getElementById("titulo-modal").textContent =
        libro.titulo;

    // Número de serie: código original de MySQL.
    document.getElementById("numero-serie-modal").textContent =
        libro.serie;

    document.getElementById("autor-modal").textContent =
        libro.autor;

    // Materia vacía.
    document.getElementById("materia-modal").textContent = "";

    // Clasificación: rango calculado con el ID.
    document.getElementById("tema-modal").textContent =
        libro.clasificacion;

    // Cambiar la etiqueta de Tema a Clasificación.
    const etiqueta = document.getElementById("tema-modal")
        .previousElementSibling;

    if (etiqueta) {
        etiqueta.textContent = "Clasificación:";
    }

    document.getElementById("descripcion-modal").textContent =
        libro.descripcion;

    const imagen = document.getElementById("imagen-modal");

    imagen.src = libro.imagen;
    imagen.alt = libro.titulo;

    imagen.onerror = () => {
        imagen.onerror = null;
        imagen.src = "https://placehold.co/300x420?text=Libro";
    };

    ventanaLibro.style.display = "flex";
}

function cerrarLibro() {
    ventanaLibro.style.display = "none";
}

// ==========================================
// INICIO Y CIERRE DE SESIÓN
// ==========================================
function abrirLogin() {
    document.getElementById("usuario").value = "";
    document.getElementById("contrasena").value = "";
    document.getElementById("mensaje-login").textContent = "";

    ventanaLogin.style.display = "flex";

    document.getElementById("usuario").focus();
}

function cerrarLogin() {
    ventanaLogin.style.display = "none";
}

function iniciarSesion(event) {
    event.preventDefault();

    const usuario = document.getElementById("usuario").value.trim();
    const contrasena = document.getElementById("contrasena").value;

    if (
        usuario === USUARIO_ADMIN &&
        contrasena === CONTRASENA_ADMIN
    ) {
        cerrarLogin();
        abrirAdmin();
    } else {
        document.getElementById("mensaje-login").textContent =
            "Usuario o contraseña incorrectos.";
    }
}

// ==========================================
// ADMINISTRACIÓN
// ==========================================
function abrirAdmin() {
    ventanaAdmin.style.display = "flex";

    document.getElementById("buscador-admin").value = "";
    document.getElementById("lista-libros-admin").innerHTML = "";

    cancelarEdicion();
}

function cerrarAdmin() {
    ventanaAdmin.style.display = "none";

    cancelarEdicion();
    mostrarLibros();
}

function buscarLibroAdmin() {
    const texto = document.getElementById("buscador-admin")
        .value.toLowerCase().trim();

    const contenedor = document.getElementById("lista-libros-admin");

    if (!texto) {
        contenedor.innerHTML = "";
        return;
    }

    const resultados = libros
        .map((libro, indice) => ({ libro, indice }))
        .filter(({ libro }) => {
            const datos = [
                libro.titulo,
                libro.autor,
                libro.materia,
                libro.serie,
                libro.clasificacion,
                libro.id
            ];

            return datos.some(valor =>
                String(valor ?? "").toLowerCase().includes(texto)
            );
        })
        .slice(0, LIMITE_RESULTADOS_ADMIN);

    mostrarListaAdmin(resultados);
}

function mostrarListaAdmin(lista) {
    const contenedor = document.getElementById("lista-libros-admin");

    contenedor.innerHTML = "";

    lista.forEach(({ libro, indice }) => {
        const elemento = document.createElement("div");

        elemento.className = "item-admin";

        elemento.innerHTML = `
            <img
                src="${escaparHTML(libro.imagen)}"
                alt="${escaparHTML(libro.titulo)}">

            <div class="datos-admin">
                <h4>${escaparHTML(libro.titulo)}</h4>

                <p>
                    <strong>Número de serie:</strong>
                    ${escaparHTML(libro.serie)}
                </p>

                <p>
                    <strong>Autor:</strong>
                    ${escaparHTML(libro.autor)}
                </p>

                <p>
                    <strong>Clasificación:</strong>
                    ${escaparHTML(libro.clasificacion)}
                </p>
            </div>

            <div class="acciones-admin">
                <button
                    class="btn-editar"
                    onclick="editarLibro(${indice})">
                    ✏️ Editar
                </button>

                <button
                    class="btn-eliminar"
                    onclick="eliminarLibro(${indice})">
                    🗑️ Eliminar
                </button>
            </div>
        `;

        const imagen = elemento.querySelector("img");

        imagen.onerror = () => {
            imagen.onerror = null;
            imagen.src = "https://placehold.co/300x420?text=Libro";
        };

        contenedor.appendChild(elemento);
    });
}

// ==========================================
// GUARDAR CAMBIOS ADMINISTRATIVOS LOCALES
// ==========================================
// Estas operaciones aún no modifican MySQL.
function guardarEnLocalStorage() {
    localStorage.setItem(
        "catalogoFrayServando",
        JSON.stringify(libros)
    );
}

function guardarLibro() {
    const titulo = document.getElementById("admin-titulo").value.trim();
    const autor = document.getElementById("admin-autor").value.trim();
    const materia = document.getElementById("admin-materia").value.trim();
    const serie = document.getElementById("admin-serie").value.trim();
    const imagen = document.getElementById("admin-imagen").value.trim();
    const descripcion = document.getElementById("admin-descripcion").value.trim();
    const indice = document.getElementById("indice-libro").value;

    if (!titulo || !autor || !serie) {
        alert("Completa al menos el título, el autor y el número de serie.");
        return;
    }

    const nuevoLibro = {
        id: indice === "" ? null : libros[Number(indice)]?.id,
        titulo,
        autor,
        materia,
        serie,
        clasificacion: detectarTema(
            indice === "" ? libros.length + 1 : libros[Number(indice)]?.id
        ),
        imagen: imagen || "https://placehold.co/300x420?text=Libro",
        descripcion: descripcion || "Año de publicación no especificado"
    };

    if (indice === "") {
        libros.push(nuevoLibro);
        alert("Libro agregado al catálogo local.");
    } else {
        libros[Number(indice)] = nuevoLibro;
        alert("Libro actualizado en el catálogo local.");
    }

    guardarEnLocalStorage();
    mostrarLibros();
    cancelarEdicion();
    buscarLibroAdmin();
}

function editarLibro(indice) {
    const libro = libros[indice];

    if (!libro) return;

    document.getElementById("indice-libro").value = indice;
    document.getElementById("admin-titulo").value = libro.titulo;
    document.getElementById("admin-autor").value = libro.autor;
    document.getElementById("admin-materia").value = libro.materia;
    document.getElementById("admin-serie").value = libro.serie;
    document.getElementById("admin-imagen").value = libro.imagen;
    document.getElementById("admin-descripcion").value = libro.descripcion;

    document.getElementById("titulo-formulario").textContent =
        "Editar libro";

    document.querySelector(".formulario-admin")?.scrollIntoView({
        behavior: "smooth"
    });
}

function eliminarLibro(indice) {
    const libro = libros[indice];

    if (!libro) return;

    if (!confirm(
        `¿Seguro que quieres eliminar "${libro.titulo}" del catálogo local?`
    )) {
        return;
    }

    libros.splice(indice, 1);

    guardarEnLocalStorage();
    mostrarLibros();
    cancelarEdicion();
    buscarLibroAdmin();
}

function cancelarEdicion() {
    const campos = [
        "indice-libro",
        "admin-titulo",
        "admin-autor",
        "admin-materia",
        "admin-serie",
        "admin-imagen",
        "admin-descripcion"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.value = "";
        }
    });

    const titulo = document.getElementById("titulo-formulario");

    if (titulo) {
        titulo.textContent = "Agregar nuevo libro";
    }
}

 // ==========================================
 // SOLICITUDES DE LIBROS
 // ==========================================

function abrirSolicitudes() {
    document.getElementById("formulario-solicitud").reset();

    document.getElementById("mensaje-solicitud").textContent = "";

    ventanaSolicitudes.style.display = "flex";
}

function cerrarSolicitudes() {
    ventanaSolicitudes.style.display = "none";
}

/* MOSTRAR SOLICITUDES A LOS ENCARGADOS */
async function cargarSolicitudes() {
    const contenedor = document.getElementById("lista-solicitudes-admin");

    contenedor.innerHTML = "<p>Cargando solicitudes...</p>";

    try {
        const respuesta = await fetch("/api/solicitudes");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las solicitudes.");
        }

        const solicitudes = await respuesta.json();

        contenedor.innerHTML = "";

        if (solicitudes.length === 0) {
            contenedor.innerHTML = "<p>No hay solicitudes recibidas.</p>";
            return;
        }


solicitudes.forEach(solicitud => {
    const elemento = document.createElement("div");

    elemento.className = "item-admin";

    elemento.innerHTML = `
        <div class="datos-admin">
            <h4>${escaparHTML(solicitud.titulo)}</h4>

            <p><strong>Autor:</strong> ${escaparHTML(solicitud.autor)}</p>

            <p><strong>Editorial:</strong> ${escaparHTML(solicitud.editorial || "No especificada")}</p>

            <p><strong>Comentarios:</strong> ${escaparHTML(solicitud.comentarios || "Sin comentarios")}</p>

            <p><strong>Fecha:</strong> ${escaparHTML(solicitud.fecha_solicitud)}</p>

            <p><strong>Estado:</strong>
                <span class="estado-solicitud">
                    ${escaparHTML(solicitud.estado)}
                </span>
            </p>

        ${
    solicitud.estado === "Pendiente"
    ?`
        <div class="botones-solicitud">

            <button
                class="btn-confirmar"
                onclick="actualizarEstadoSolicitud(${Number(solicitud.id)}, 'Confirmada')">
                ✓ Confirmar
            </button>

            <button
                class="btn-rechazar"
                onclick="actualizarEstadoSolicitud(${Number(solicitud.id)}, 'Rechazada')">
                ✕ Rechazar
            </button>

        </div>
    `
    : ""
 }
            `;

    contenedor.appendChild(elemento);
});

    } catch (error) {
        console.error("Error al cargar solicitudes:", error);

        contenedor.innerHTML =
            "<p>No se pudieron cargar las solicitudes.</p>";
    }
}


// ENVIAR SOLICITUD A MYSQL
document.getElementById("formulario-solicitud").addEventListener("submit", async function(event) {

    event.preventDefault();

    const titulo = document.getElementById("solicitud-titulo").value.trim();
    const autor = document.getElementById("solicitud-autor").value.trim();
    const editorial = document.getElementById("solicitud-editorial").value.trim();
    const comentarios = document.getElementById("solicitud-comentarios").value.trim();

    const mensaje = document.getElementById("mensaje-solicitud");

    mensaje.textContent = "Enviando solicitud...";

    try {

        const respuesta = await fetch("/api/solicitudes", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                titulo,
                autor,
                editorial,
                comentarios
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo enviar la solicitud.");
        }

        mensaje.textContent = "¡Solicitud enviada correctamente!";

        document.getElementById("formulario-solicitud").reset();

    } catch (error) {

    console.error("Error al enviar solicitud:", error);

    mensaje.textContent = "Error: " + error.message;
}


});
// ====================================
// CONFIRMAR O RECHAZAR SOLICITUDES
// ====================================

async function actualizarEstadoSolicitud(id, estado) {

    const confirmacion = confirm(
        `¿Estás seguro de que deseas ${estado.toLowerCase()} esta solicitud?`
    );

    if (!confirmacion) return;

    try {

        const respuesta = await fetch(`/api/solicitudes/${id}/estado`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ estado })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo actualizar.");
        }

        alert(resultado.mensaje);

        // Recargar las solicitudes para mostrar el nuevo estado
        cargarSolicitudes();

    } catch (error) {

        console.error("Error al actualizar solicitud:", error);

        alert("No se pudo actualizar la solicitud.");
    }
}


// ==========================================
// CERRAR VENTANAS
// ==========================================
window.addEventListener("click", event => {
    if (event.target === ventanaLibro) {
        cerrarLibro();
    }

    if (event.target === ventanaLogin) {
        cerrarLogin();
    }
    if (event.target === ventanaSolicitudes) {
    cerrarSolicitudes();
}
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        cerrarLibro();
        cerrarLogin();
        cerrarSolicitudes();
    }
});

// ==========================================
// INICIAR CATÁLOGO
// ==========================================
cargarLibrosDesdeBD();

// ====================================
// MOSTRAR LIBROS MÁS BUSCADOS
// ====================================

async function mostrarMasBuscados() {
    try {
        const respuesta = await fetch("/api/libros-mas-buscados");
        const resultados = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultados.error || "Error al obtener los libros.");
        }

        if (resultados.length === 0) {
            alert("Todavía no hay libros más buscados.");
            return;
        }

        const ids = resultados.map(libro => Number(libro.ID));

        const populares = libros.filter(libro =>
            ids.includes(Number(libro.id))
        );

        mostrarLibros(populares);

    } catch (error) {
        console.error(error);
        alert("No se pudieron cargar los libros más buscados.");
    }
}

// ====================================
// MOSTRAR ESTADÍSTICAS DE LIBROS
// ====================================

let graficaBarras = null;
let graficaCircular = null;
let graficaMaterias = null;

async function mostrarEstadisticas() {
    try {
        const respuesta = await fetch("/api/estadisticas-libros");
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.error || "Error al cargar estadísticas");
        }

        if (datos.libros.length === 0) {
            alert("Todavía no hay estadísticas de libros.");
            return;
        }

        // Mostrar la sección de estadísticas
        document.getElementById("seccion-estadisticas").style.display = "block";

        // Mostrar total de aperturas
        document.getElementById("total-aperturas").textContent =
            "Total de libros abiertos: " + datos.total;

        // Obtener títulos y cantidades
        const titulos = datos.libros.map(libro => libro.Titulo);
        const cantidades = datos.libros.map(libro => libro.cantidad);

        // ====================================
        // GRÁFICA DE BARRAS
        // ====================================

        const contextoBarras = document
            .getElementById("grafica-barras")
            .getContext("2d");

        if (graficaBarras) {
            graficaBarras.destroy();
        }

        graficaBarras = new Chart(contextoBarras, {
            type: "bar",
            data: {
                labels: titulos,
                datasets: [{
                    label: "Veces abierto",
                    data: cantidades,
                    backgroundColor: "rgba(54, 162, 235, 0.6)",
                    borderColor: "rgb(54, 162, 235)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: "y",
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });

        // ====================================
        // GRÁFICA CIRCULAR
        // ====================================

        const contextoCircular = document
            .getElementById("grafica-circular")
            .getContext("2d");

        if (graficaCircular) {
            graficaCircular.destroy();
        }

        graficaCircular = new Chart(contextoCircular, {
            type: "pie",
            data: {
                labels: titulos,
                datasets: [{
                    label: "Porcentaje de visitas",
                    data: cantidades
                }]
            },
            options: {
                responsive: true
            }
        });

    } catch (error) {
        console.error("Error:", error);
        alert("No se pudieron cargar las estadísticas.");
    }
}

// ====================================
// GRÁFICA DE MATERIAS
// ====================================

const nombresMaterias = datos.materias.map(
    materia => materia.Clasificacion || "Sin clasificación"
);

const visitasMaterias = datos.materias.map(
    materia => materia.cantidad
);

const contextoMaterias = document
    .getElementById("grafica-materias")
    .getContext("2d");

if (graficaMaterias) {
    graficaMaterias.destroy();
}

graficaMaterias = new Chart(contextoMaterias, {
    type: "bar",
    data: {
        labels: nombresMaterias,
        datasets: [{
            label: "Visitas por materia",
            data: visitasMaterias,
            backgroundColor: "rgba(245, 130, 32, 0.7)",
            borderColor: "#e87518",
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        indexAxis: "y",
        scales: {
            x: {
                beginAtZero: true
            }
        }
    }
});
function cerrarEstadisticas() {
    document.getElementById("seccion-estadisticas").style.display = "none";
}

