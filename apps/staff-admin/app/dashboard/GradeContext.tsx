'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchApi } from '../../lib/api';

type Grade = {
  id: string;
  nameAr: string;
};

type GradeContextType = {
  grades: Grade[];
  selectedGradeId: string;
  setSelectedGradeId: (id: string) => void;
  loading: boolean;
};

const GradeContext = createContext<GradeContextType | undefined>(undefined);

export function GradeProvider({ children }: { children: ReactNode }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/admin/v1/academic')
      .then((res) => {
        const fetchedGrades = res.data?.grades || [];
        setGrades(fetchedGrades);

        // Try to restore from localStorage
        const savedGradeId = localStorage.getItem('staff_selected_grade_id');
        if (savedGradeId && fetchedGrades.find((g: Grade) => g.id === savedGradeId)) {
          setSelectedGradeId(savedGradeId);
        } else if (fetchedGrades.length > 0) {
          setSelectedGradeId(fetchedGrades[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSetSelectedGradeId = (id: string) => {
    setSelectedGradeId(id);
    localStorage.setItem('staff_selected_grade_id', id);
  };

  return (
    <GradeContext.Provider
      value={{
        grades,
        selectedGradeId,
        setSelectedGradeId: handleSetSelectedGradeId,
        loading,
      }}
    >
      {children}
    </GradeContext.Provider>
  );
}

export function useGrade() {
  const context = useContext(GradeContext);
  if (context === undefined) {
    throw new Error('useGrade must be used within a GradeProvider');
  }
  return context;
}
