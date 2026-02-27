import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, MapPin, Phone, Mail, User, Plus, X, CheckCircle, AlertCircle, Circle, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type ActivityType = 'meeting' | 'call' | 'task' | 'email' | 'follow_up';
type ActivityStatus = 'scheduled' | 'completed' | 'cancelled' | 'overdue';
type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

interface ScheduledActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  scheduled_at: string;
  completed_at: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  location: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    full_name: string;
    phone: string;
    email: string | null;
  };
}

interface NewActivity {
  lead_id: string;
  activity_type: ActivityType;
  title: string;
  description: string;
  scheduled_at: string;
  priority: ActivityPriority;
  location: string;
  duration_minutes: string;
}

export default function Agenda() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewActivityModal, setShowNewActivityModal] = useState(false);
  const [leads, setLeads] = useState<Array<{ id: string; full_name: string }>>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | ActivityStatus>('all');
  const [filterType, setFilterType] = useState<'all' | ActivityType>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [newActivity, setNewActivity] = useState<NewActivity>({
    lead_id: '',
    activity_type: 'meeting',
    title: '',
    description: '',
    scheduled_at: '',
    priority: 'medium',
    location: '',
    duration_minutes: '30',
  });

  useEffect(() => {
    fetchActivities();
    fetchLeads();
  }, [filterStatus, filterType]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, full_name')
      .order('full_name');

    if (data) setLeads(data);
  };

  const fetchActivities = async () => {
    setLoading(true);

    let query = supabase
      .from('scheduled_activities')
      .select(`
        *,
        lead:leads(full_name, phone, email)
      `)
      .order('scheduled_at', { ascending: true });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    if (filterType !== 'all') {
      query = query.eq('activity_type', filterType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
    } else {
      setActivities(data || []);
    }

    setLoading(false);
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const activityData = {
      ...newActivity,
      user_id: user.id,
      duration_minutes: parseInt(newActivity.duration_minutes) || null,
    };

    const { error } = await supabase
      .from('scheduled_activities')
      .insert([activityData]);

    if (error) {
      console.error('Error creating activity:', error);
      alert('Erro ao criar atividade');
    } else {
      setShowNewActivityModal(false);
      setNewActivity({
        lead_id: '',
        activity_type: 'meeting',
        title: '',
        description: '',
        scheduled_at: '',
        priority: 'medium',
        location: '',
        duration_minutes: '30',
      });
      fetchActivities();
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    const { error } = await supabase
      .from('scheduled_activities')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', activityId);

    if (error) {
      console.error('Error completing activity:', error);
    } else {
      fetchActivities();
    }
  };

  const handleCancelActivity = async (activityId: string) => {
    const { error } = await supabase
      .from('scheduled_activities')
      .update({ status: 'cancelled' })
      .eq('id', activityId);

    if (error) {
      console.error('Error cancelling activity:', error);
    } else {
      fetchActivities();
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    const labels = {
      meeting: 'Reunião',
      call: 'Ligação',
      task: 'Tarefa',
      email: 'E-mail',
      follow_up: 'Follow-up',
    };
    return labels[type];
  };

  const getActivityTypeColor = (type: ActivityType) => {
    const colors = {
      meeting: 'bg-blue-100 text-blue-800',
      call: 'bg-green-100 text-green-800',
      task: 'bg-purple-100 text-purple-800',
      email: 'bg-yellow-100 text-yellow-800',
      follow_up: 'bg-orange-100 text-orange-800',
    };
    return colors[type];
  };

  const getPriorityColor = (priority: ActivityPriority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority];
  };

  const getPriorityLabel = (priority: ActivityPriority) => {
    const labels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return labels[priority];
  };

  const getStatusIcon = (status: ActivityStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <X className="w-5 h-5 text-red-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Circle className="w-5 h-5 text-blue-600" />;
    }
  };

  const groupActivitiesByDate = (activities: ScheduledActivity[]) => {
    const groups: { [key: string]: ScheduledActivity[] } = {};

    activities.forEach((activity) => {
      const date = new Date(activity.scheduled_at).toLocaleDateString('pt-BR');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return groups;
  };

  const groupedActivities = groupActivitiesByDate(activities);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getActivitiesForDate = (date: Date) => {
    return activities.filter(activity => {
      const activityDate = new Date(activity.scheduled_at);
      return (
        activityDate.getDate() === date.getDate() &&
        activityDate.getMonth() === date.getMonth() &&
        activityDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const renderCalendarView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[120px] bg-gray-50"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayActivities = getActivitiesForDate(currentDate);
      const isToday =
        currentDate.getDate() === new Date().getDate() &&
        currentDate.getMonth() === new Date().getMonth() &&
        currentDate.getFullYear() === new Date().getFullYear();

      days.push(
        <div
          key={day}
          className={`min-h-[120px] border border-gray-200 p-2 ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
        >
          <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
            {day}
            {isToday && <span className="ml-1 text-xs">(Hoje)</span>}
          </div>
          <div className="space-y-1">
            {dayActivities.slice(0, 3).map(activity => (
              <div
                key={activity.id}
                className={`text-xs p-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${getActivityTypeColor(activity.activity_type)}`}
                title={`${activity.title} - ${new Date(activity.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              >
                <div className="font-medium truncate">
                  {new Date(activity.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {activity.title}
                </div>
              </div>
            ))}
            {dayActivities.length > 3 && (
              <div className="text-xs text-gray-600 pl-1.5">
                +{dayActivities.length - 3} mais
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">{monthName}</h2>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Hoje
              </button>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-semibold text-gray-700">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-600 mt-1">Gerencie todas as atividades agendadas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Calendário
            </button>
          </div>
          <button
            onClick={() => setShowNewActivityModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Atividade
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="scheduled">Agendado</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
              <option value="overdue">Atrasado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="meeting">Reunião</option>
              <option value="call">Ligação</option>
              <option value="task">Tarefa</option>
              <option value="email">E-mail</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : viewMode === 'calendar' ? (
        renderCalendarView()
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma atividade encontrada</h3>
          <p className="text-gray-600 mb-4">Comece criando uma nova atividade agendada</p>
          <button
            onClick={() => setShowNewActivityModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Atividade
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dateActivities]) => (
            <div key={date}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {date}
              </h2>
              <div className="space-y-3">
                {dateActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(activity.status)}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{activity.title}</h3>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActivityTypeColor(activity.activity_type)}`}>
                              {getActivityTypeLabel(activity.activity_type)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(activity.priority)}`}>
                              {getPriorityLabel(activity.priority)}
                            </span>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                          )}
                        </div>
                      </div>
                      {activity.status === 'scheduled' && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleCompleteActivity(activity.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Concluir"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleCancelActivity(activity.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDateTime(activity.scheduled_at)}
                      </div>
                      {activity.duration_minutes && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {activity.duration_minutes} minutos
                        </div>
                      )}
                      {activity.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {activity.location}
                        </div>
                      )}
                      {activity.lead && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {activity.lead.full_name}
                        </div>
                      )}
                    </div>

                    {activity.lead && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-4 h-4" />
                          {activity.lead.phone}
                        </div>
                        {activity.lead.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-4 h-4" />
                            {activity.lead.email}
                          </div>
                        )}
                      </div>
                    )}

                    {activity.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          <strong>Notas:</strong> {activity.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewActivityModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Nova Atividade</h2>
              <button
                onClick={() => setShowNewActivityModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead *
                </label>
                <select
                  required
                  value={newActivity.lead_id}
                  onChange={(e) => setNewActivity({ ...newActivity, lead_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={newActivity.activity_type}
                    onChange={(e) => setNewActivity({ ...newActivity, activity_type: e.target.value as ActivityType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="meeting">Reunião</option>
                    <option value="call">Ligação</option>
                    <option value="task">Tarefa</option>
                    <option value="email">E-mail</option>
                    <option value="follow_up">Follow-up</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridade *
                  </label>
                  <select
                    value={newActivity.priority}
                    onChange={(e) => setNewActivity({ ...newActivity, priority: e.target.value as ActivityPriority })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Reunião de apresentação"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Detalhes da atividade..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data e Hora *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newActivity.scheduled_at}
                    onChange={(e) => setNewActivity({ ...newActivity, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duração (minutos)
                  </label>
                  <input
                    type="number"
                    value={newActivity.duration_minutes}
                    onChange={(e) => setNewActivity({ ...newActivity, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local / Link
                </label>
                <input
                  type="text"
                  value={newActivity.location}
                  onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Escritório ou https://meet.google.com/..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewActivityModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Criar Atividade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
