// 🔒 Política de Tratamiento de Datos y Privacidad de IsaBot.
export function PrivacyPolicyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card privacy-card" onClick={(e) => e.stopPropagation()}>
        <h3>🔒 Política de Tratamiento de Datos y Privacidad</h3>
        <p className="habits-sub">
          IsaBot es un producto de <b>IsaRoRo Studio</b>, creado por Isabella Rodríguez Roque.
          Queremos que sepas exactamente qué guardamos y para qué.
        </p>

        <div className="privacy-body">
          <h4>¿Qué guardamos?</h4>
          <ul>
            <li>Tu cuenta: correo, nombre y foto de perfil.</li>
            <li>Tus conversaciones con IsaBot y las imágenes que generas.</li>
            <li>Tus proyectos de IsaStudio, tareas, notas, recordatorios y publicaciones de IsaSpace.</li>
            <li>Tu memoria de IsaBot: gustos, metas y tono preferido.</li>
          </ul>

          <h4>¿Para qué lo usamos?</h4>
          <ul>
            <li>Únicamente para darle <b>memoria continua</b> al chat y que IsaBot te recuerde y te acompañe mejor.</li>
            <li>Para mostrarte tu propio historial cuando vuelves a entrar.</li>
            <li>Para métricas internas anónimas de uso (cuántos mensajes, qué secciones se usan).</li>
          </ul>

          <h4>¿Dónde se guardan?</h4>
          <p>
            En la base de datos segura de IsaBot, con reglas de acceso por usuario: solo tú puedes
            leer tus conversaciones, tus proyectos y tu memoria desde tu cuenta.
          </p>

          <h4>¿Se comparten con terceros?</h4>
          <p>
            <b>No.</b> No vendemos ni compartimos tus datos con terceros, ni los usamos para
            publicidad. El texto de tu mensaje se envía al motor de IA solo en el momento de
            responderte, y nada de lo que escribes se usa para entrenar modelos externos.
          </p>

          <h4>Tus derechos</h4>
          <ul>
            <li>Puedes borrar cualquier chat desde el menú lateral.</li>
            <li>Puedes borrar tu memoria de IsaBot desde tu perfil.</li>
            <li>Puedes eliminar tu cuenta y todos tus datos desde tu perfil.</li>
          </ul>

          <h4>Contacto</h4>
          <p>Para cualquier duda o solicitud sobre tus datos: isaroro2021@gmail.com</p>
        </div>

        <div className="settings-actions">
          <button className="kawaii-sidebar-btn" onClick={onClose}>
            Entendido 💕
          </button>
        </div>
      </div>
    </div>
  );
}
