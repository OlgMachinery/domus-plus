# Si diste de alta a otro usuario y ya no te deja entrar

## Qué puede haber pasado

Al dar de alta a otro usuario (agregar integrante y/o hacerlo admin), **la aplicación no quita tu sesión**. Pueden pasar dos cosas:

1. **Quedaste con la sesión del nuevo usuario**  
   Si en el mismo navegador abriste la pantalla de **registro** (/register) o **iniciaste sesión con el correo del nuevo usuario**, la cookie de sesión pasó a ser de ese usuario. Entonces “ya no te deja entrar” a **ti** porque el sistema te ve como el otro usuario.

2. **La sesión se dañó o se perdió**  
   Menos frecuente: cookie borrada, cambio de dispositivo o error al guardar la sesión.

## Qué hacer para volver a entrar (tú)

1. **Cerrar sesión**  
   En la app: usa **Cerrar sesión** (arriba a la derecha).

2. **Volver a iniciar sesión con tu correo y contraseña**  
   El que usabas antes de dar de alta al otro usuario. Así la sesión vuelve a ser la tuya y podrás entrar con tu usuario y tu rol (admin o no).

3. Si no ves el botón de cerrar sesión (pantalla en blanco o error):
   - Abre la misma URL de DOMUS en una **ventana de incógnito** o otro navegador.
   - Entra a la página de **inicio de sesión** (login).
   - Inicia sesión con **tu** correo y contraseña.

## Comprobaciones en el sistema

- Dar de alta a otro usuario **no** quita tu rol de admin ni tu membresía.
- Puede haber **varios admins** en la misma familia; dar admin a otro no te lo quita a ti.
- La única forma de “perder” la sesión en este flujo es que el navegador haya pasado a tener la sesión del **otro** usuario (por registro o login con su correo). Por eso cerrar sesión y volver a entrar con tu correo suele solucionarlo.

## Si sigue sin dejarte entrar

- Confirma que usas **tu** correo (el tuyo, no el del usuario que diste de alta).
- Si no recuerdas la contraseña: de momento no hay “recuperar contraseña” en la app; hace falta que otro admin te la restablezca o que se cambie directo en la base de datos (contactar a quien administre el servidor).
- Si entras pero no ves la familia: en el selector de familia (arriba) elige de nuevo tu familia; si no aparece, puede que tu usuario se haya quitado de esa familia por error (habría que revisar en la base de datos).
