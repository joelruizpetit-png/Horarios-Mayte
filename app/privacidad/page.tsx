import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de privacidad | Planificador Familiar',
  description: 'Información sobre el tratamiento de datos personales en Planificador Familiar.'
};

const sectionStyle = { marginTop: 28 };

export default function PoliticaPrivacidad() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 22px 64px', color: '#1f2937', lineHeight: 1.7 }}>
      <Link href="/" style={{ color: '#1d4ed8' }}>← Volver a Planificador Familiar</Link>
      <h1 style={{ marginTop: 24, marginBottom: 8, color: '#123b75', fontSize: 34, lineHeight: 1.2 }}>Política de privacidad</h1>
      <p><strong>Última actualización:</strong> 19 de octubre de 2026</p>
      <p>Esta política explica cómo se tratan los datos personales al utilizar Planificador Familiar, una aplicación privada para organizar agenda, turnos, menús, deportes, finanzas familiares y listas de compra.</p>

      <section style={sectionStyle}>
        <h2>1. Responsable y contacto</h2>
        <p><strong>Responsable:</strong> Joel Ruiz Petit.</p>
        <p><strong>Correo de contacto y privacidad:</strong> <a href="mailto:joelruizpetit@gmail.com">joelruizpetit@gmail.com</a>.</p>
      </section>

      <section style={sectionStyle}>
        <h2>2. Datos que se tratan</h2>
        <ul>
          <li>Datos de cuenta necesarios para iniciar sesión, como identificador de usuario y correo electrónico.</li>
          <li>Información que los usuarios introducen en la aplicación: eventos y turnos de agenda, menús, datos de organización familiar, movimientos financieros y artículos de compra.</li>
          <li>Si se conecta Google Calendar: datos de eventos necesarios para mostrarlos y sincronizarlos, además de los datos técnicos de autorización. El permiso de renovación se guarda en una cookie protegida del servidor; el token de acceso temporal se guarda en el navegador.</li>
          <li>Datos técnicos imprescindibles para recordar preferencias y el funcionamiento de la aplicación en el navegador.</li>
        </ul>
        <p>La aplicación no solicita datos de categorías especiales. Evita incluir información especialmente sensible en títulos, notas o campos de la aplicación.</p>
      </section>

      <section style={sectionStyle}>
        <h2>3. Finalidades y base del tratamiento</h2>
        <ul>
          <li>Autenticar a las personas autorizadas y proteger el acceso a la aplicación.</li>
          <li>Guardar y mostrar la información de organización familiar que el usuario incorpora.</li>
          <li>Con autorización del usuario, consultar y crear, actualizar o eliminar eventos en su calendario principal de Google para ofrecer la sincronización solicitada. Esta conexión puede revocarse desde la configuración de la cuenta de Google.</li>
          <li>Mantener la seguridad y el funcionamiento técnico del servicio.</li>
        </ul>
        <p>El tratamiento se basa en la solicitud del usuario de utilizar estas funciones, en su autorización para conectar Google Calendar y, cuando corresponda, en el interés legítimo de mantener la seguridad y disponibilidad de la aplicación.</p>
      </section>

      <section style={sectionStyle}>
        <h2>4. Servicios que intervienen</h2>
        <p>La aplicación utiliza Firebase Authentication y Cloud Firestore para el acceso y almacenamiento de datos, Vercel para alojar la aplicación y los servicios de Google OAuth y Google Calendar cuando el usuario los conecta. La sección deportiva puede consultar proveedores externos para obtener calendarios y resultados públicos. No se envía a esos proveedores la agenda familiar para obtener esos datos deportivos.</p>
        <p>Estos proveedores pueden tratar información conforme a sus propias políticas y prestar servicios desde distintos países. Consulta las políticas de Google, Firebase y Vercel para conocer sus prácticas y garantías de transferencias internacionales.</p>
      </section>

      <section style={sectionStyle}>
        <h2>5. Conservación y eliminación</h2>
        <p>La información familiar se conserva mientras siga almacenada en la aplicación. Para solicitar acceso, rectificación o eliminación, escribe a <a href="mailto:joelruizpetit@gmail.com">joelruizpetit@gmail.com</a> indicando qué cuenta utilizas. La autorización de Google Calendar puede revocarse en cualquier momento desde la configuración de seguridad de tu cuenta de Google; revocarla impide futuras consultas y sincronizaciones. Los registros técnicos de los proveedores pueden conservarse según sus propias políticas.</p>
      </section>

      <section style={sectionStyle}>
        <h2>6. Derechos</h2>
        <p>Puedes solicitar acceso, rectificación, supresión, limitación u oposición al tratamiento y, cuando proceda, la portabilidad de tus datos. También puedes retirar el consentimiento para Google Calendar sin que ello afecte al tratamiento realizado antes de retirarlo. Contacta con el responsable en el correo indicado. Si consideras que tus derechos no han sido atendidos, puedes presentar una reclamación ante la Agencia Española de Protección de Datos en <a href="https://www.aepd.es/" target="_blank" rel="noreferrer">aepd.es</a>.</p>
      </section>

      <section style={sectionStyle}>
        <h2>7. Seguridad y cambios</h2>
        <p>Se aplican medidas técnicas destinadas a proteger el acceso y la transmisión de la información, incluidas conexiones HTTPS y almacenamiento protegido de la autorización renovable de Google Calendar. Ningún servicio conectado a Internet puede garantizar seguridad absoluta. Esta política podrá actualizarse cuando cambie la aplicación o el tratamiento de datos; la fecha de actualización se indicará al principio.</p>
      </section>
    </main>
  );
}
