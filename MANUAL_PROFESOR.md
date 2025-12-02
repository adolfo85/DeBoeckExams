# Manual de Usuario - Rol Profesor
**DeBoeckExams**

Bienvenido al manual de usuario para profesores de la plataforma DeBoeckExams. Este documento le guiará a través de todas las funcionalidades disponibles para gestionar sus materias, crear exámenes y evaluar a sus alumnos.

---

## Índice
1. [Acceso al Sistema](#1-acceso-al-sistema)
2. [Panel Principal](#2-panel-principal)
3. [Gestión de Materias](#3-gestión-de-materias)
4. [Banco de Preguntas](#4-banco-de-preguntas)
5. [Configuración de Examen](#5-configuración-de-examen)
6. [Resultados y Calificaciones](#6-resultados-y-calificaciones)
7. [Gestión de Usuarios (Solo Administradores)](#7-gestión-de-usuarios)

---

## 1. Acceso al Sistema

Para ingresar al sistema, diríjase a la página de inicio y seleccione la opción "Soy Profesor".

- **Registro:** Si es su primera vez, seleccione "Registrarse", complete sus datos y espere la aprobación de un administrador.
- **Login:** Ingrese su email y contraseña.

> **Nota:** Si su cuenta está pendiente de aprobación, no podrá ingresar hasta que un administrador lo habilite.

---

## 2. Panel Principal

Una vez dentro, verá el Panel de Administración. En la parte superior encontrará:
- Su nombre de usuario.
- **Botón "Link para Alumnos":** Copia al portapapeles el enlace directo que debe compartir con sus estudiantes para que rindan el examen.
- **Botón "Cerrar Sesión".**

El panel se divide en pestañas para facilitar la navegación:

![Panel Principal - Materias](admin_subjects.png)

---

## 3. Gestión de Materias

En la pestaña **"Materias"**, usted puede:

1. **Crear una nueva materia:** Escriba el nombre de la materia en el campo de texto y presione "Crear Materia".
2. **Ver sus materias:** Aparecerán listadas en tarjetas.
3. **Eliminar materias:** Use el icono de papelera en la tarjeta de la materia.
   > **¡Cuidado!** Eliminar una materia borrará también todas sus preguntas y el historial de exámenes de esa materia.

---

## 4. Banco de Preguntas

En la pestaña **"Banco de Preguntas"**, primero debe seleccionar la materia sobre la cual desea trabajar.

![Banco de Preguntas](admin_questions.png)

### Crear Preguntas
Puede crear tres tipos de preguntas:

1. **Opción Múltiple:**
   - Escriba el enunciado.
   - Defina la cantidad de opciones (de 2 a 8).
   - Escriba las opciones y marque la correcta seleccionando el círculo (radio button) correspondiente.

2. **Verdadero / Falso:**
   - Escriba el enunciado.
   - Seleccione si la afirmación es Verdadera o Falsa.

3. **Completar Frase:**
   - Escriba el enunciado utilizando el comodín `{blank}` donde debe ir la palabra a completar.
   - Escriba las opciones posibles y marque la correcta.
   - *Ejemplo:* "La capital de Francia es {blank}." (Opciones: Madrid, París, Londres -> Correcta: París).

### Gestionar Preguntas
- **Activar/Desactivar:** Use el interruptor (toggle) para incluir o excluir una pregunta del examen sin borrarla.
- **Eliminar:** Borra la pregunta permanentemente.
- **Habilitar/Deshabilitar Todas:** Botones rápidos para gestionar el estado de todas las preguntas a la vez.

---

## 5. Configuración de Examen

En la pestaña **"Configuración de Examen"** controla cuándo los alumnos pueden rendir.

![Configuración de Examen](admin_exams.png)

Para cada materia, usted puede:
1. **Activar Examen:** Al hacer clic en "Activar Examen", la prueba se vuelve visible para los alumnos que ingresen con su link.
2. **Definir Nota de Aprobación:** Seleccione la nota mínima (4, 5, 6 o 7) que representa el 60% del puntaje.
3. **Finalizar Examen:** Cuando termine el tiempo, presione "Finalizar y Ver Resultados". Esto desactivará el examen automáticamente y lo llevará a la tabla de notas.

---

## 6. Resultados y Calificaciones

La pestaña **"Resultados"** muestra el historial de exámenes rendidos.

![Resultados](admin_results.png)

- **Filtros:** Puede ver los resultados de todas las materias o filtrar por una específica.
- **Métricas:** Tarjetas con el total de evaluados, promedio general y porcentaje de aprobados.
- **Tabla Detallada:** Muestra fecha, nombre del alumno, puntaje (aciertos/total), nota final y estado (Aprobado/Reprobado).
- **Imprimir / PDF:** Genera un reporte listo para imprimir o guardar como PDF.
- **Borrar Historial:** Elimina los registros de exámenes (útil para limpiar datos de años anteriores).

---

## 7. Gestión de Usuarios

*(Visible solo para Super Administradores)*

Aquí podrá ver a los profesores registrados.
- **Aprobar:** Permite el acceso al sistema a nuevos profesores.
- **Eliminar:** Borra la cuenta de un profesor.

---

**Soporte Técnico**
Si tiene problemas con la plataforma, contacte al administrador del sistema.
