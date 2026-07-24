import type { Publication } from '../types/domain';

export const mockProfessionals: Publication[] = [
  {
    id: 1,
    titulo: 'Diseño de identidad visual premium',
    categoria: 'Diseño',
    descripcion: 'Branding, logotipos, manual de marca y piezas para redes sociales.',
    ubicacion: 'Queretaro',
    salario: '450',
    nombre_prestador: 'Ana Morales',
    promedio_calificacion: '4.9',
    disponibilidad: 'Disponible esta semana',
  },
  {
    id: 2,
    titulo: 'Instalaciones electricas residenciales',
    categoria: 'Electricidad',
    descripcion: 'Diagnostico, reparacion e instalacion segura para casa y oficina.',
    ubicacion: 'El Marques',
    salario: '320',
    nombre_prestador: 'Luis Herrera',
    promedio_calificacion: '4.8',
    disponibilidad: 'Respuesta en 1 hora',
  },
  {
    id: 3,
    titulo: 'Landing pages y sistemas web',
    categoria: 'Programación',
    descripcion: 'Sitios modernos, paneles administrativos y automatizaciones para negocios.',
    ubicacion: 'Remoto',
    salario: '650',
    nombre_prestador: 'Mariana Rios',
    promedio_calificacion: '5.0',
    disponibilidad: 'Agenda abierta',
  },
];
