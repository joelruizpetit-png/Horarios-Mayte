import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { obtenerPropuestasPartidos } = require('../../../servidorApuestas.js');
    const resultado = await obtenerPropuestasPartidos();
    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const detalle = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en /api/apuestas:', detalle);
    return NextResponse.json(
      {
        error: 'Error al ejecutar el motor de Inteligencia IA de apuestas',
        detalle,
      },
      { status: 500 }
    );
  }
}
