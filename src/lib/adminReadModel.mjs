const ADMIN_SECTIONS = new Set(['home', 'trainers', 'clients', 'programs', 'nutrition', 'audit', 'settings']);

export function canEnterAdmin(role) {
  return role === 'admin';
}

/** @param {string} section @param {string | null} [id] */
export function getAdminNavigationTarget(section, id = null) {
  if (section === 'trainer') return { section: 'trainers', selectedId: id };
  if (section === 'client') return { section: 'clients', selectedId: id };
  if (ADMIN_SECTIONS.has(section)) return { section, selectedId: section === 'programs' ? id : null };
  return { section: 'home', selectedId: null };
}

export function buildAdminReadModel({ profiles = [], trainerProfiles = [], clients = [], programs = [], nutritionPlans = [] }) {
  const trainerPresentation = new Map(trainerProfiles.map(profile => [String(profile.id), profile]));
  const programById = new Map(programs.map(program => [String(program.id), program]));
  const clientById = new Map(clients.map(client => [String(client.id), client]));
  const trainers = profiles
    .filter(profile => profile.role === 'trainer')
    .map(profile => {
      const presentation = trainerPresentation.get(String(profile.id));
      const ownedClients = clients.filter(client => String(client.trainer_id) === String(profile.id));
      const ownedPrograms = programs.filter(program => String(program.trainer_id) === String(profile.id));
      return {
        id: String(profile.id),
        name: presentation?.name || profile.full_name || profile.email || 'Trainer sin nombre',
        email: profile.email || '',
        initials: presentation?.initials || '',
        avatarUrl: presentation?.avatar_url || '',
        createdAt: profile.created_at || null,
        clients: ownedClients,
        programs: ownedPrograms,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const mappedClients = clients.map(client => ({
    ...client,
    trainer: trainers.find(trainer => trainer.id === String(client.trainer_id)) || null,
    program: client.assigned_program_id ? programById.get(String(client.assigned_program_id)) || null : null,
  })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));

  const mappedPrograms = programs.map(program => ({
    ...program,
    trainer: trainers.find(trainer => trainer.id === String(program.trainer_id)) || null,
    clients: mappedClients.filter(client => String(client.assigned_program_id) === String(program.id)),
  })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));

  const mappedNutritionPlans = nutritionPlans.map(plan => ({
    ...plan,
    client: clientById.get(String(plan.client_id)) || null,
    trainer: trainers.find(trainer => trainer.id === String(plan.trainer_id)) || null,
  }));

  return { trainers, clients: mappedClients, programs: mappedPrograms, nutritionPlans: mappedNutritionPlans };
}

export function searchAdminDirectory(model, value) {
  const query = String(value || '').trim().toLocaleLowerCase('es');
  if (!query) return { trainers: [], clients: [] };
  return {
    trainers: model.trainers.filter(trainer => `${trainer.name} ${trainer.email}`.toLocaleLowerCase('es').includes(query)),
    clients: model.clients.filter(client => `${client.name || ''} ${client.email || ''} ${client.objective || ''}`.toLocaleLowerCase('es').includes(query)),
  };
}

export async function fetchAdminReadModel(supabase) {
  const requests = [
    ['profiles', supabase.from('profiles').select('id,email,full_name,role,created_at').eq('role', 'trainer')],
    ['trainer_profiles', supabase.from('trainer_profiles').select('id,name,initials,avatar_url')],
    ['clients', supabase.from('clients').select('id,user_id,trainer_id,name,email,phone,status,objective,assigned_program_id,current_weight,created_at,updated_at')],
    ['programs', supabase.from('programs').select('id,trainer_id,name,type,level,duration_weeks,days_per_week,created_at,updated_at')],
    ['nutrition_plans', supabase.from('nutrition_plans').select('id,client_id,trainer_id,created_at,updated_at')],
  ];
  const results = await Promise.all(requests.map(async ([name, request]) => ({ name, ...(await request) })));
  const failed = results.find(result => result.error);
  if (failed) throw new Error(`No se pudieron cargar los datos de ${failed.name}. Comprueba los permisos y vuelve a intentarlo.`);
  const rows = Object.fromEntries(results.map(result => [result.name, result.data || []]));
  return buildAdminReadModel({
    profiles: rows.profiles,
    trainerProfiles: rows.trainer_profiles,
    clients: rows.clients,
    programs: rows.programs,
    nutritionPlans: rows.nutrition_plans,
  });
}
