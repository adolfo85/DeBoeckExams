import React, { useState, useEffect, useMemo } from 'react';
import { Subject, GradebookEntry, StudentAcademicStatus } from '../types';
import { storageService } from '../services/storageService';
import { calculateAcademicStatus, formatStudentName } from '../services/gradebookUtils';
import { Button } from './Button';
import { Modal } from './Modal';

interface GradebookViewProps {
  subjects: Subject[];
  teacherId: string;
  isSuperAdmin: boolean;
  isActive: boolean;
}

export const GradebookView: React.FC<GradebookViewProps> = ({
  subjects,
  teacherId,
  isSuperAdmin,
  isActive
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [academicYear, setAcademicYear] = useState<number>(currentYear);
  const [entries, setEntries] = useState<GradebookEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentAcademicStatus>('all');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GradebookEntry | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<GradebookEntry | null>(null);

  // Notification message
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects]);

  useEffect(() => {
    if (isActive && selectedSubjectId) {
      loadGradebook();
    }
  }, [isActive, selectedSubjectId, academicYear]);

  const loadGradebook = async () => {
    if (!selectedSubjectId) return;
    try {
      setIsLoading(true);
      const data = await storageService.getGradebookEntries(selectedSubjectId, academicYear);
      setEntries(data);
    } catch (err) {
      console.error('Error loading gradebook:', err);
      showNotification('Error al cargar la planilla de calificaciones', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSearch =
        !searchTerm.trim() ||
        (e.studentLastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.studentFirstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.studentDni || '').includes(searchTerm.trim());

      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [entries, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = entries.length;
    const promocionados = entries.filter(e => e.status === 'promocionado').length;
    const regulares = entries.filter(e => e.status === 'regular').length;
    const libres = entries.filter(e => e.status === 'libre').length;

    const gradesWithFinal = entries.filter(e => e.finalGrade !== null && e.finalGrade !== undefined);
    const avgGrade =
      gradesWithFinal.length > 0
        ? (gradesWithFinal.reduce((acc, curr) => acc + (curr.finalGrade || 0), 0) / gradesWithFinal.length).toFixed(1)
        : '-';

    return { total, promocionados, regulares, libres, avgGrade };
  }, [entries]);

  // Quick inline status change
  const handleQuickStatusChange = async (entry: GradebookEntry, newStatus: string) => {
    try {
      if (newStatus === 'auto') {
        // Recalculate automatic status
        const calc = calculateAcademicStatus({
          c1Exam: entry.c1Exam,
          c1Recup: entry.c1Recup,
          c2Exam: entry.c2Exam,
          c2Recup: entry.c2Recup,
          isOverride: false
        });
        await storageService.updateGradebookEntry(entry.id, {
          status: calc.status,
          statusOverride: false
        });
        showNotification(`Condición de ${entry.studentLastName} restablecida a automática (${calc.status.toUpperCase()})`);
      } else {
        await storageService.updateGradebookEntry(entry.id, {
          status: newStatus as StudentAcademicStatus,
          statusOverride: true
        });
        showNotification(`Condición de ${entry.studentLastName} actualizada a ${newStatus.toUpperCase()}`);
      }
      loadGradebook();
    } catch (err) {
      console.error(err);
      showNotification('Error al actualizar condición', 'error');
    }
  };

  // Delete student
  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await storageService.deleteGradebookEntry(deleteCandidate.id);
      showNotification(`Alumno ${deleteCandidate.studentLastName} eliminado de la planilla.`);
      setDeleteCandidate(null);
      loadGradebook();
    } catch (err) {
      console.error(err);
      showNotification('Error al eliminar alumno', 'error');
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (entries.length === 0) {
      alert('No hay alumnos para exportar en esta planilla.');
      return;
    }
    const subjectName = currentSubject?.name || 'Materia';
    const filename = `Planilla_${subjectName.replace(/\s+/g, '_')}_${academicYear}.csv`;

    const headers = [
      'DNI',
      'Apellido',
      'Nombre',
      '1C Examen',
      '1C Recuperatorio',
      'Nota Final 1C',
      '2C Examen',
      '2C Recuperatorio',
      'Nota Final 2C',
      'Promedio Definitivo',
      'Condición',
      'Tipo Condición'
    ];

    const rows = entries.map(e => [
      e.studentDni || '',
      `"${e.studentLastName}"`,
      `"${e.studentFirstName}"`,
      e.c1Exam !== null && e.c1Exam !== undefined ? e.c1Exam : '',
      e.c1Recup !== null && e.c1Recup !== undefined ? e.c1Recup : '',
      e.c1Final !== null && e.c1Final !== undefined ? e.c1Final : '',
      e.c2Exam !== null && e.c2Exam !== undefined ? e.c2Exam : '',
      e.c2Recup !== null && e.c2Recup !== undefined ? e.c2Recup : '',
      e.c2Final !== null && e.c2Final !== undefined ? e.c2Final : '',
      e.finalGrade !== null && e.finalGrade !== undefined ? e.finalGrade : '',
      e.status ? e.status.toUpperCase() : 'REGULAR',
      e.statusOverride ? 'Manual' : 'Automática'
    ]);

    // UTF-8 BOM (\uFEFF) for Excel compatibility
    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const handlePrintPDF = () => {
    if (entries.length === 0) {
      alert('No hay datos cargados para imprimir.');
      return;
    }
    const printWindow = window.open('', '', 'height=850,width=1100');
    if (!printWindow) return;

    const subjectName = currentSubject?.name || 'Espacio Curricular';
    const dateStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Planilla de Exámenes - ${subjectName}</title>
        <style>
          @page { size: A4 landscape; margin: 1.5cm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 10px; color: #1e293b; font-size: 11px; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 14px; }
          .header h1 { margin: 0; font-size: 18px; color: #0f766e; }
          .header .subtitle { margin-top: 4px; font-size: 13px; color: #475569; font-weight: 600; }
          .header-meta { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #64748b; }
          .stats-bar { display: flex; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 4px; margin-bottom: 14px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
          th { background: #f1f5f9; color: #334155; font-weight: bold; }
          th.sub-th { font-size: 9.5px; background: #f8fafc; }
          td.text-left { text-align: left; }
          .bold { font-weight: bold; }
          .prom { background-color: #f0fdf4; color: #166534; font-weight: bold; }
          .reg { background-color: #fefce8; color: #854d0e; font-weight: bold; }
          .lib { background-color: #fef2f2; color: #991b1b; font-weight: bold; }
          .footer-signatures { margin-top: 45px; display: flex; justify-content: space-around; }
          .sig-line { width: 220px; border-top: 1px dashed #64748b; text-align: center; padding-top: 5px; font-size: 10px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DeBoeck Exams — Planilla de Calificaciones y Exámenes</h1>
          <div class="subtitle">Espacio Curricular: ${subjectName} — Ciclo Lectivo: ${academicYear}</div>
          <div class="header-meta">
            <span>Fecha de emisión: ${dateStr}</span>
            <span>Total Alumnos: ${entries.length}</span>
          </div>
        </div>

        <div class="stats-bar">
          <div><strong>Promocionados:</strong> ${stats.promocionados} (${stats.total ? ((stats.promocionados / stats.total) * 100).toFixed(0) : 0}%)</div>
          <div><strong>Regulares:</strong> ${stats.regulares} (${stats.total ? ((stats.regulares / stats.total) * 100).toFixed(0) : 0}%)</div>
          <div><strong>Libres:</strong> ${stats.libres} (${stats.total ? ((stats.libres / stats.total) * 100).toFixed(0) : 0}%)</div>
          <div><strong>Promedio General:</strong> ${stats.avgGrade}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 25px;">#</th>
              <th rowspan="2" style="width: 80px;">DNI</th>
              <th rowspan="2" class="text-left">Apellido y Nombre</th>
              <th colspan="3">1° Cuatrimestre</th>
              <th colspan="3">2° Cuatrimestre</th>
              <th rowspan="2" style="width: 65px;">Promedio Definitivo</th>
              <th rowspan="2" style="width: 95px;">Condición Final</th>
            </tr>
            <tr>
              <th class="sub-th" style="width: 48px;">Examen</th>
              <th class="sub-th" style="width: 48px;">Recup.</th>
              <th class="sub-th" style="width: 52px;">Final 1C</th>
              <th class="sub-th" style="width: 48px;">Examen</th>
              <th class="sub-th" style="width: 48px;">Recup.</th>
              <th class="sub-th" style="width: 52px;">Final 2C</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map(
                (e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${e.studentDni || '-'}</td>
                <td class="text-left bold">${e.studentLastName}, ${e.studentFirstName}</td>
                <td>${e.c1Exam !== null && e.c1Exam !== undefined ? e.c1Exam.toFixed(1) : '-'}</td>
                <td>${e.c1Recup !== null && e.c1Recup !== undefined ? e.c1Recup.toFixed(1) : '-'}</td>
                <td class="bold">${e.c1Final !== null && e.c1Final !== undefined ? e.c1Final.toFixed(1) : '-'}</td>
                <td>${e.c2Exam !== null && e.c2Exam !== undefined ? e.c2Exam.toFixed(1) : '-'}</td>
                <td>${e.c2Recup !== null && e.c2Recup !== undefined ? e.c2Recup.toFixed(1) : '-'}</td>
                <td class="bold">${e.c2Final !== null && e.c2Final !== undefined ? e.c2Final.toFixed(1) : '-'}</td>
                <td class="bold">${e.finalGrade !== null && e.finalGrade !== undefined ? e.finalGrade.toFixed(1) : '-'}</td>
                <td class="${
                  e.status === 'promocionado' ? 'prom' : e.status === 'libre' ? 'lib' : 'reg'
                }">${e.status ? e.status.toUpperCase() : 'REGULAR'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer-signatures">
          <div class="sig-line">Firma del Docente</div>
          <div class="sig-line">Aclaración / DNI</div>
          <div class="sig-line">Secretaría Académica / Dirección</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  const getStatusBadge = (entry: GradebookEntry) => {
    switch (entry.status) {
      case 'promocionado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            Promocionado {entry.statusOverride && <span title="Modificado manualmente por docente">✎</span>}
          </span>
        );
      case 'regular':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Regular {entry.statusOverride && <span title="Modificado manualmente por docente">✎</span>}
          </span>
        );
      case 'libre':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            Libre {entry.statusOverride && <span title="Modificado manualmente por docente">✎</span>}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            {entry.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 border transition-all animate-bounce ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span>{notification.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header controls & Filters */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>📋</span> Planilla de Exámenes y Calificaciones
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Seguimiento cuatrimestral por materia: parciales, recuperatorios, notas finales y condición académica.
          </p>
        </div>

        {/* Materia & Año Selectors */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Espacio Curricular
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg text-sm px-3 py-2 font-medium text-gray-800 focus:ring-emerald-500 focus:border-emerald-500 outline-none min-w-[200px]"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Ciclo Lectivo
            </label>
            <select
              value={academicYear}
              onChange={e => setAcademicYear(Number(e.target.value))}
              className="bg-white border border-gray-300 rounded-lg text-sm px-3 py-2 font-medium text-gray-800 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear + 1}>{currentYear + 1}</option>
            </select>
          </div>

          <div className="self-end">
            <Button
              variant="outline"
              onClick={loadGradebook}
              className="text-xs border-gray-300 h-[38px] hover:bg-gray-50"
              title="Recargar datos"
            >
              🔄
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Matriculados</span>
          <span className="text-2xl font-bold text-gray-800 mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">Promocionados</span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-emerald-600">{stats.promocionados}</span>
            <span className="text-xs text-gray-400">({stats.total ? ((stats.promocionados / stats.total) * 100).toFixed(0) : 0}%)</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-amber-700 text-[10px] font-bold uppercase tracking-wider block">Regulares</span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-amber-600">{stats.regulares}</span>
            <span className="text-xs text-gray-400">({stats.total ? ((stats.regulares / stats.total) * 100).toFixed(0) : 0}%)</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-red-700 text-[10px] font-bold uppercase tracking-wider block">Libres</span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-red-600">{stats.libres}</span>
            <span className="text-xs text-gray-400">({stats.total ? ((stats.libres / stats.total) * 100).toFixed(0) : 0}%)</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center col-span-2 sm:col-span-1">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Promedio Materia</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">{stats.avgGrade}</span>
        </div>
      </div>

      {/* Action Toolbar & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Buscar por alumno o DNI..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg text-xs pl-8 pr-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-white border border-gray-300 rounded-lg text-xs px-3 py-2 text-gray-700 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Todas las condiciones</option>
            <option value="promocionado">Solo Promocionados</option>
            <option value="regular">Solo Regulares</option>
            <option value="libre">Solo Libres</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            title="Descargar archivo compatible con Excel"
          >
            <span>📊</span> Exportar Excel
          </Button>

          <Button
            variant="outline"
            onClick={handlePrintPDF}
            className="text-xs border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            title="Imprimir acta o guardar como PDF"
          >
            <span>🖨️</span> Imprimir / PDF
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            <span>➕</span> Agregar Alumno
          </Button>
        </div>
      </div>

      {/* Gradebook Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-3 text-xs text-gray-500">Cargando planilla de calificaciones...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-4xl text-gray-300">📋</div>
            <h3 className="text-sm font-bold text-gray-700">No hay alumnos registrados en esta planilla</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Puedes cargar alumnos manualmente con el botón <strong>"Agregar Alumno"</strong>, o trasladar directamente las notas de los exámenes desde la pestaña <strong>"Resultados"</strong>.
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={() => setIsAddModalOpen(true)} className="text-xs">
                ➕ Agregar Primer Alumno
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600">
                  <th rowSpan={2} className="px-3 py-3 text-center font-bold text-[11px] w-10">
                    #
                  </th>
                  <th rowSpan={2} className="px-3 py-3 text-left font-bold text-[11px] w-24">
                    DNI
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-left font-bold text-[11px] min-w-[200px]">
                    Alumno (Apellido, Nombre)
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center font-bold text-[11px] bg-blue-50/60 border-l border-r border-blue-100 text-blue-900">
                    1° Cuatrimestre
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center font-bold text-[11px] bg-purple-50/60 border-r border-purple-100 text-purple-900">
                    2° Cuatrimestre
                  </th>
                  <th rowSpan={2} className="px-3 py-3 text-center font-bold text-[11px] bg-gray-50 border-r border-gray-200">
                    Promedio
                  </th>
                  <th rowSpan={2} className="px-3 py-3 text-center font-bold text-[11px] min-w-[150px]">
                    Condición
                  </th>
                  <th rowSpan={2} className="px-3 py-3 text-center font-bold text-[11px] w-20">
                    Acciones
                  </th>
                </tr>
                <tr className="bg-slate-50 text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="px-2 py-1.5 text-center bg-blue-50/30 border-l border-blue-100">Parcial</th>
                  <th className="px-2 py-1.5 text-center bg-blue-50/30">Recup.</th>
                  <th className="px-2 py-1.5 text-center bg-blue-100/50 text-blue-900 font-bold border-r border-blue-100">Final 1C</th>
                  <th className="px-2 py-1.5 text-center bg-purple-50/30">Parcial</th>
                  <th className="px-2 py-1.5 text-center bg-purple-50/30">Recup.</th>
                  <th className="px-2 py-1.5 text-center bg-purple-100/50 text-purple-900 font-bold border-r border-purple-100">Final 2C</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredEntries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 text-center text-gray-400 font-mono text-[11px]">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">
                      {entry.studentDni || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <div className="font-semibold text-slate-800">
                        {entry.studentLastName}, {entry.studentFirstName}
                      </div>
                      {entry.notes && (
                        <div className="text-[10px] text-gray-400 italic mt-0.5 truncate max-w-xs" title={entry.notes}>
                          Nota: {entry.notes}
                        </div>
                      )}
                    </td>

                    {/* 1C Examen */}
                    <td className="px-2 py-2.5 text-center font-mono border-l border-blue-100">
                      {entry.c1Exam !== null && entry.c1Exam !== undefined ? (
                        <span className={entry.c1Exam >= 4 ? 'text-gray-800' : 'text-red-600 font-bold'}>
                          {entry.c1Exam.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 1C Recup */}
                    <td className="px-2 py-2.5 text-center font-mono">
                      {entry.c1Recup !== null && entry.c1Recup !== undefined ? (
                        <span className={entry.c1Recup >= 4 ? 'text-blue-700 font-semibold' : 'text-red-600 font-bold'}>
                          {entry.c1Recup.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 1C Final */}
                    <td className="px-2 py-2.5 text-center font-mono bg-blue-50/30 font-bold border-r border-blue-100">
                      {entry.c1Final !== null && entry.c1Final !== undefined ? (
                        <span className={entry.c1Final >= 6 ? 'text-emerald-700' : entry.c1Final >= 4 ? 'text-amber-700' : 'text-red-600'}>
                          {entry.c1Final.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 2C Examen */}
                    <td className="px-2 py-2.5 text-center font-mono">
                      {entry.c2Exam !== null && entry.c2Exam !== undefined ? (
                        <span className={entry.c2Exam >= 4 ? 'text-gray-800' : 'text-red-600 font-bold'}>
                          {entry.c2Exam.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 2C Recup */}
                    <td className="px-2 py-2.5 text-center font-mono">
                      {entry.c2Recup !== null && entry.c2Recup !== undefined ? (
                        <span className={entry.c2Recup >= 4 ? 'text-purple-700 font-semibold' : 'text-red-600 font-bold'}>
                          {entry.c2Recup.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 2C Final */}
                    <td className="px-2 py-2.5 text-center font-mono bg-purple-50/30 font-bold border-r border-purple-100">
                      {entry.c2Final !== null && entry.c2Final !== undefined ? (
                        <span className={entry.c2Final >= 6 ? 'text-emerald-700' : entry.c2Final >= 4 ? 'text-amber-700' : 'text-red-600'}>
                          {entry.c2Final.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Promedio Final */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold bg-slate-50 border-r border-gray-200">
                      {entry.finalGrade !== null && entry.finalGrade !== undefined ? (
                        <span className={entry.finalGrade >= 6 ? 'text-emerald-700 text-sm' : entry.finalGrade >= 4 ? 'text-amber-700 text-sm' : 'text-red-600 text-sm'}>
                          {entry.finalGrade.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Condición with quick selector */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <select
                          value={entry.statusOverride ? entry.status : 'auto'}
                          onChange={e => handleQuickStatusChange(entry, e.target.value)}
                          className={`text-xs font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                            entry.status === 'promocionado'
                              ? 'bg-green-50 text-green-800 border-green-300 focus:ring-green-400'
                              : entry.status === 'regular'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-400'
                              : 'bg-red-50 text-red-800 border-red-300 focus:ring-red-400'
                          }`}
                          title={entry.statusOverride ? 'Condición manual (haga clic para cambiar o volver a automática)' : 'Condición calculada automáticamente'}
                        >
                          {!entry.statusOverride && (
                            <option value="auto">
                              {entry.status === 'promocionado' ? 'Promocionado (Auto)' : entry.status === 'regular' ? 'Regular (Auto)' : 'Libre (Auto)'}
                            </option>
                          )}
                          <option value="promocionado">Promocionado</option>
                          <option value="regular">Regular</option>
                          <option value="libre">Libre</option>
                          {entry.statusOverride && (
                            <option value="auto">↩ Restablecer Automático</option>
                          )}
                        </select>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingEntry(entry);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-600 transition-colors rounded"
                          title="Editar alumno o calificaciones"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(entry)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded"
                          title="Eliminar de la planilla"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Editar Alumno / Calificaciones */}
      {isEditModalOpen && editingEntry && (
        <EditStudentModal
          entry={editingEntry}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEntry(null);
          }}
          onSave={async updated => {
            try {
              await storageService.updateGradebookEntry(editingEntry.id, updated);
              showNotification(`Datos de ${updated.studentLastName || editingEntry.studentLastName} actualizados con éxito.`);
              setIsEditModalOpen(false);
              setEditingEntry(null);
              loadGradebook();
            } catch (err) {
              console.error(err);
              showNotification('Error al guardar cambios', 'error');
            }
          }}
        />
      )}

      {/* Modal: Agregar Alumno Manualmente */}
      {isAddModalOpen && (
        <AddStudentModal
          subjectId={selectedSubjectId}
          academicYear={academicYear}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={async newStudent => {
            try {
              await storageService.saveGradebookEntry(newStudent);
              showNotification(`Alumno ${newStudent.studentLastName} agregado a la planilla.`);
              setIsAddModalOpen(false);
              loadGradebook();
            } catch (err) {
              console.error(err);
              showNotification('Error al agregar alumno', 'error');
            }
          }}
        />
      )}

      {/* Modal: Confirmar Eliminación */}
      <Modal
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Eliminar Alumno de la Planilla"
        message={`¿Estás seguro de que deseas eliminar a ${deleteCandidate?.studentLastName}, ${deleteCandidate?.studentFirstName} de la planilla de calificaciones de esta materia?`}
        warningItems={['Esta acción eliminará el registro de notas del alumno en esta asignatura.']}
        confirmText="Eliminar de la Planilla"
        variant="danger"
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: EditStudentModal
// ─────────────────────────────────────────────────────────────────────────────
interface EditStudentModalProps {
  entry: GradebookEntry;
  onClose: () => void;
  onSave: (updated: Partial<GradebookEntry>) => Promise<void>;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ entry, onClose, onSave }) => {
  const [lastName, setLastName] = useState(entry.studentLastName);
  const [firstName, setFirstName] = useState(entry.studentFirstName);
  const [dni, setDni] = useState(entry.studentDni || '');
  const [c1Exam, setC1Exam] = useState<string>(entry.c1Exam !== null && entry.c1Exam !== undefined ? String(entry.c1Exam) : '');
  const [c1Recup, setC1Recup] = useState<string>(entry.c1Recup !== null && entry.c1Recup !== undefined ? String(entry.c1Recup) : '');
  const [c2Exam, setC2Exam] = useState<string>(entry.c2Exam !== null && entry.c2Exam !== undefined ? String(entry.c2Exam) : '');
  const [c2Recup, setC2Recup] = useState<string>(entry.c2Recup !== null && entry.c2Recup !== undefined ? String(entry.c2Recup) : '');
  const [status, setStatus] = useState<StudentAcademicStatus>(entry.status);
  const [statusOverride, setStatusOverride] = useState<boolean>(Boolean(entry.statusOverride));
  const [notes, setNotes] = useState(entry.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Por favor complete el Apellido y Nombre del alumno.');
      return;
    }

    setIsSubmitting(true);
    const parseGrade = (v: string) => {
      if (!v.trim()) return null;
      const num = parseFloat(v.replace(',', '.'));
      return isNaN(num) ? null : Math.min(10, Math.max(1, num));
    };

    await onSave({
      studentLastName: lastName.trim().toUpperCase(),
      studentFirstName: firstName.trim(),
      studentDni: dni.trim() || undefined,
      c1Exam: parseGrade(c1Exam),
      c1Recup: parseGrade(c1Recup),
      c2Exam: parseGrade(c2Exam),
      c2Recup: parseGrade(c2Recup),
      status,
      statusOverride,
      notes: notes.trim() || undefined
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 animate-fadeIn">
        <div className="bg-slate-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-800">Editar Datos y Calificaciones</h3>
            <p className="text-xs text-gray-500">Modifica la información del alumno o sus calificaciones</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Apellido(s) *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Nombre(s) *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
              DNI (sin puntos)
            </label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 38123456"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Calificaciones 1C y 2C */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Calificaciones Cuatrimestrales (Escala 1 a 10)
            </span>
            <div className="grid grid-cols-2 gap-4">
              {/* 1C */}
              <div className="space-y-2 border-r border-slate-200 pr-2">
                <span className="text-[11px] font-bold text-blue-800 block">1° Cuatrimestre</span>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Examen Parcial</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c1Exam}
                    onChange={e => setC1Exam(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Recuperatorio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c1Recup}
                    onChange={e => setC1Recup(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>

              {/* 2C */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-purple-800 block">2° Cuatrimestre</span>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Examen Parcial</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c2Exam}
                    onChange={e => setC2Exam(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Recuperatorio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c2Recup}
                    onChange={e => setC2Recup(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Condición */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Condición del Alumno
              </label>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value as StudentAcademicStatus);
                  setStatusOverride(true);
                }}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none"
              >
                <option value="promocionado">Promocionado</option>
                <option value="regular">Regular</option>
                <option value="libre">Libre</option>
              </select>
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={statusOverride}
                  onChange={e => setStatusOverride(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Forzar condición manual (ignora cálculo automático)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
              Observaciones / Notas (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Rindió recuperatorio en mesa especial, presentó certificado..."
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: AddStudentModal
// ─────────────────────────────────────────────────────────────────────────────
interface AddStudentModalProps {
  subjectId: string;
  academicYear: number;
  onClose: () => void;
  onAdd: (student: any) => Promise<void>;
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ subjectId, academicYear, onClose, onAdd }) => {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dni, setDni] = useState('');
  const [c1Exam, setC1Exam] = useState('');
  const [c1Recup, setC1Recup] = useState('');
  const [c2Exam, setC2Exam] = useState('');
  const [c2Recup, setC2Recup] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Por favor ingrese el Apellido y Nombre del alumno.');
      return;
    }

    setIsSubmitting(true);
    const parseGrade = (v: string) => {
      if (!v.trim()) return null;
      const num = parseFloat(v.replace(',', '.'));
      return isNaN(num) ? null : Math.min(10, Math.max(1, num));
    };

    await onAdd({
      subjectId,
      academicYear,
      studentLastName: lastName.trim().toUpperCase(),
      studentFirstName: firstName.trim(),
      studentDni: dni.trim() || undefined,
      c1Exam: parseGrade(c1Exam),
      c1Recup: parseGrade(c1Recup),
      c2Exam: parseGrade(c2Exam),
      c2Recup: parseGrade(c2Recup),
      status: 'regular',
      statusOverride: false,
      notes: notes.trim() || undefined
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 animate-fadeIn">
        <div className="bg-slate-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-800">Agregar Alumno a la Planilla</h3>
            <p className="text-xs text-gray-500">Ingresa los datos del alumno y sus notas (si ya rindió)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Apellido(s) *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej: PÉREZ"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Nombre(s) *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Juan Carlos"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
              DNI (sin puntos)
            </label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 38123456"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Calificaciones Iniciales Opcionales */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Calificaciones Iniciales (Opcionales)
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 border-r border-slate-200 pr-2">
                <span className="text-[11px] font-bold text-blue-800 block">1° Cuatrimestre</span>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Examen Parcial</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c1Exam}
                    onChange={e => setC1Exam(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Recuperatorio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c1Recup}
                    onChange={e => setC1Recup(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-purple-800 block">2° Cuatrimestre</span>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Examen Parcial</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c2Exam}
                    onChange={e => setC2Exam(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase">Recuperatorio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="—"
                    value={c2Recup}
                    onChange={e => setC2Recup(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
              Observaciones (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Alumno transferido..."
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Agregando...' : 'Agregar Alumno'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
