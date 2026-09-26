import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClientData, Program, NutritionPlan, AccentColor, TrainerProfile } from '../types';
import { INITIAL_CLIENTS, INITIAL_PROGRAMS, INITIAL_NUTRITION_PLAN } from '../data/mockData';

const INITIAL_TRAINER: TrainerProfile = {
  id: 'trn-1',
  name: 'Jesús S.',
  email: 'soyroafit@gmail.com',
  initials: 'JS',
  role: 'Entrenador',
  avatarUrl: '',
  couponCode: 'STRAINER20'
};

interface AppContextType {
  appName: string;
  setAppName: (name: string) => void;
  trainer: TrainerProfile;
  updateTrainer: (partial: Partial<TrainerProfile>) => void;
  clients: ClientData[];
  activeClient: ClientData;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  programs: Program[];
  nutritionPlans: Record<string, NutritionPlan>;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  updateClient: (id: string, partial: Partial<ClientData>) => void;
  updateClientPhoto: (id: string, avatarUrl: string) => void;
  addClient: (client: Partial<ClientData>) => void;
  addTrainerNote: (clientId: string, content: string) => void;
  updateProgram: (program: Program) => void;
  addProgram: (program: Program) => void;
  updateNutritionPlan: (clientId: string, plan: NutritionPlan) => void;
  toggleMealCompleted: (clientId: string, mealId: string) => void;
  toggleShoppingItem: (clientId: string, category: string, itemName: string) => void;
  addFoodToLog: (clientId: string, foodName: string, kcal: number, protein?: number) => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appName, setAppNameState] = useState<string>(() => {
    const saved = localStorage.getItem('strainer_app_name');
    if (!saved || saved.toLowerCase().includes('roafit') || saved === 'S-Trainer app') {
      return 'S-Trainer app — Plataforma de Entrenamiento';
    }
    return saved;
  });

  const [trainer, setTrainer] = useState<TrainerProfile>(() => {
    const saved = localStorage.getItem('strainer_trainer');
    return saved ? JSON.parse(saved) : INITIAL_TRAINER;
  });

  const [clients, setClients] = useState<ClientData[]>(() => {
    const saved = localStorage.getItem('strainer_clients') || localStorage.getItem('roafit_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [activeClientId, setActiveClientId] = useState<string>('cli-juan');

  const [programs, setPrograms] = useState<Program[]>(() => {
    const saved = localStorage.getItem('strainer_programs') || localStorage.getItem('roafit_programs');
    return saved ? JSON.parse(saved) : INITIAL_PROGRAMS;
  });

  const [nutritionPlans, setNutritionPlans] = useState<Record<string, NutritionPlan>>(() => {
    const saved = localStorage.getItem('strainer_nutrition') || localStorage.getItem('roafit_nutrition');
    return saved ? JSON.parse(saved) : { 'cli-juan': INITIAL_NUTRITION_PLAN };
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('strainer_accent') || localStorage.getItem('roafit_accent');
    return (saved as AccentColor) || '#CFFF5C';
  });

  const setAppName = (name: string) => {
    setAppNameState(name);
    localStorage.setItem('strainer_app_name', name);
  };

  const updateTrainer = (partial: Partial<TrainerProfile>) => {
    setTrainer(prev => {
      const updated = { ...prev, ...partial };
      if (partial.name && !partial.initials) {
        updated.initials = partial.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      }
      localStorage.setItem('strainer_trainer', JSON.stringify(updated));
      return updated;
    });
  };

  const updateClientPhoto = (clientId: string, avatarUrl: string) => {
    updateClient(clientId, { avatarUrl });
  };

  useEffect(() => {
    localStorage.setItem('strainer_app_name', appName);
  }, [appName]);

  useEffect(() => {
    localStorage.setItem('strainer_trainer', JSON.stringify(trainer));
  }, [trainer]);

  useEffect(() => {
    localStorage.setItem('strainer_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('strainer_programs', JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    localStorage.setItem('strainer_nutrition', JSON.stringify(nutritionPlans));
  }, [nutritionPlans]);

  useEffect(() => {
    localStorage.setItem('strainer_accent', accentColor);
    document.documentElement.style.setProperty('--accent-color', accentColor);
    // If accent is light lime or gold, text is dark #101012; else white
    const darkText = accentColor === '#CFFF5C' || accentColor === '#FFD34D';
    document.documentElement.style.setProperty('--accent-text', darkText ? '#101012' : '#FFFFFF');
  }, [accentColor]);

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  const updateClient = (id: string, partial: Partial<ClientData>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...partial } : c));
  };

  const addClient = (clientData: Partial<ClientData>) => {
    const newId = `cli-${Date.now()}`;
    const initials = (clientData.name || 'Nuevo')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newClient: ClientData = {
      id: newId,
      name: clientData.name || 'Nuevo Cliente',
      initials: initials || 'NC',
      email: clientData.email || '',
      phone: clientData.phone || '',
      birthDate: clientData.birthDate || '1995-01-01',
      sex: clientData.sex || 'Hombre',
      height: clientData.height || '175 cm',
      objective: clientData.objective || 'Hipertrofia',
      status: clientData.status || 'Activo',
      nextWorkout: 'Hoy · Inicio',
      adherencePercentage: 100,
      completedWorkoutsCount: 0,
      totalScheduledWorkoutsCount: 4,
      currentWeight: clientData.currentWeight || 75.0,
      initialWeight: clientData.currentWeight || 75.0,
      targetWeight: clientData.targetWeight || 72.0,
      weightWeeklyTrend: '→ 0,0 kg / semana',
      lastCheckIn: 'Hoy',
      pathologies: clientData.pathologies || {
        hasLimitations: false,
        training: 'Sin limitaciones articulares.',
        nutrition: 'Sin restricciones.'
      },
      menstrualTracking: clientData.menstrualTracking || {
        enabled: false,
        sharedWithTrainer: false,
        day: 0,
        phase: 'Folicular',
        advice: ''
      },
      metrics: {
        stepsToday: 4500,
        stepsGoal: 9000,
        kcalToday: 1200,
        kcalGoal: 2200,
        sleepHours: '7h 30min',
        sleepQuality: 'Buena',
        waterLiters: 1.5,
        waterGoal: 2.5
      },
      assignedProgramId: clientData.assignedProgramId || 'prog-1',
      weeklySchedule: [
        { day: 'L', status: 'completed' },
        { day: 'M', status: 'pending' },
        { day: 'X', status: 'rest' },
        { day: 'J', status: 'pending' },
        { day: 'V', status: 'pending' },
        { day: 'S', status: 'rest' },
        { day: 'D', status: 'rest' },
      ],
      strengthProgression: [],
      bodyMeasurements: { cintura: 80, cadera: 95, pecho: 98, brazo: 34, lastUpdated: 'Reciente' },
      impedanceHistory: [{ date: 'HOY', weight: clientData.currentWeight || 75.0, fatPercentage: 18.0, muscleMassKg: 58.0, waterPercentage: 55 }],
      trainerNotes: [{ id: `tn-${Date.now()}`, date: 'Hoy', content: 'Alta creada por el entrenador.' }]
    };

    setClients(prev => [newClient, ...prev]);
    setActiveClientId(newId);
  };

  const addTrainerNote = (clientId: string, content: string) => {
    const newNote = {
      id: `tn-${Date.now()}`,
      date: 'Hoy',
      content
    };
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          trainerNotes: [newNote, ...c.trainerNotes]
        };
      }
      return c;
    }));
  };

  const updateProgram = (program: Program) => {
    setPrograms(prev => prev.map(p => p.id === program.id ? program : p));
  };

  const addProgram = (program: Program) => {
    setPrograms(prev => [program, ...prev]);
  };

  const updateNutritionPlan = (clientId: string, plan: NutritionPlan) => {
    setNutritionPlans(prev => ({
      ...prev,
      [clientId]: plan
    }));
  };

  const toggleMealCompleted = (clientId: string, mealId: string) => {
    setNutritionPlans(prev => {
      const plan = prev[clientId] || INITIAL_NUTRITION_PLAN;
      const updatedMeals = plan.meals.map(m => m.id === mealId ? { ...m, completed: !m.completed } : m);
      const updatedPlan = { ...plan, meals: updatedMeals };
      return { ...prev, [clientId]: updatedPlan };
    });
  };

  const toggleShoppingItem = (clientId: string, categoryName: string, itemName: string) => {
    setNutritionPlans(prev => {
      const plan = prev[clientId] || INITIAL_NUTRITION_PLAN;
      const updatedCategories = plan.shoppingList.map(cat => {
        if (cat.category === categoryName) {
          return {
            ...cat,
            items: cat.items.map(item => item.name === itemName ? { ...item, checked: !item.checked } : item)
          };
        }
        return cat;
      });
      return {
        ...prev,
        [clientId]: { ...plan, shoppingList: updatedCategories }
      };
    });
  };

  const addFoodToLog = (clientId: string, foodName: string, kcal: number) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          metrics: {
            ...c.metrics,
            kcalToday: c.metrics.kcalToday + kcal
          }
        };
      }
      return c;
    }));
  };

  const resetAllData = () => {
    localStorage.removeItem('strainer_clients');
    localStorage.removeItem('strainer_programs');
    localStorage.removeItem('strainer_nutrition');
    localStorage.removeItem('strainer_accent');
    localStorage.removeItem('roafit_clients');
    localStorage.removeItem('roafit_programs');
    localStorage.removeItem('roafit_nutrition');
    localStorage.removeItem('roafit_accent');
    setClients(INITIAL_CLIENTS);
    setPrograms(INITIAL_PROGRAMS);
    setNutritionPlans({ 'cli-juan': INITIAL_NUTRITION_PLAN });
    setAccentColor('#CFFF5C');
    setActiveClientId('cli-juan');
  };

  return (
    <AppContext.Provider
      value={{
        appName,
        setAppName,
        trainer,
        updateTrainer,
        clients,
        activeClient,
        activeClientId,
        setActiveClientId,
        programs,
        nutritionPlans,
        accentColor,
        setAccentColor,
        updateClient,
        updateClientPhoto,
        addClient,
        addTrainerNote,
        updateProgram,
        addProgram,
        updateNutritionPlan,
        toggleMealCompleted,
        toggleShoppingItem,
        addFoodToLog,
        resetAllData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
