import React from 'react';
import { BookOpen, GraduationCap, User, ShieldAlert } from 'lucide-react';

export const AcademicFooter: React.FC = () => {
  return (
    <footer className="academic-footer mt-16 py-8 border-t border-[var(--border)]" aria-label="Créditos Académicos e Investigación">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-[var(--ink3)] font-mono text-[11px] uppercase tracking-wider">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--ink)]">
            <GraduationCap size={14} className="text-[var(--ink2)]" />
            <strong className="font-sans font-semibold tracking-normal text-[12px]">UNIVERSIDAD INTERNACIONAL DE LA RIOJA (UNIR)</strong>
          </div>
          <p className="normal-case tracking-normal text-[12px] font-sans">
            Máster Universitario en Análisis y Visualización de Datos Masivos
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <User size={13} />
            <span>Autor: <strong className="text-[var(--ink)]">Joseph David Gari Bustos</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={13} />
            <span>Director: <strong className="text-[var(--ink)]">Luis Guadalupe Macias Trejo</strong></span>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-[var(--error)]" />
            <span>TFM — PROTOTIPO EXPERIMENTAL AURA</span>
          </div>
          <span className="text-[10px] text-[var(--ink3)]">© {new Date().getFullYear()} · TODOS LOS DERECHOS RESERVADOS</span>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-dashed border-[var(--border)] flex justify-between items-center text-[9px] text-[var(--ink3)] font-mono">
        <span>OE1-OE4: MOTOR DETERMINISTA · MULTI-MODELO · WEBLLM · HITL</span>
        <span>INFRAESTRUCTURA SOBERANA LOCAL-FIRST (CAPA 0-3)</span>
      </div>
    </footer>
  );
};

export default AcademicFooter;
