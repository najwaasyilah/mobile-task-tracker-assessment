import { useState, useEffect } from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Check, Trash2, Plus, ArrowLeft, Bell, Calendar, Pencil, X } from 'lucide-react';

const GET_TODOS = gql`
  query GetTodos {
    me {
      id
      email
    }
    todos {
      id
      title
      completed
      priority
      time
      date
    }
  }
`;

const CREATE_TODO = gql`
  mutation CreateTodo($title: String!, $priority: String!, $time: String!, $date: String!) {
    createTodo(title: $title, priority: $priority, time: $time, date: $date) {
      id
      title
      completed
      priority
      time
      date
    }
  }
`;

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      id
      completed
    }
  }
`;

const UPDATE_TODO_TITLE = gql`
  mutation UpdateTodoTitle($id: ID!, $title: String!, $priority: String!, $time: String!, $date: String!) {
    updateTodoTitle(id: $id, title: $title, priority: $priority, time: $time, date: $date) {
      id
      title
      priority
      time
      date
    }
  }
`;

const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id)
  }
`;

const formatTime24To12 = (time24) => {
  if (!time24 || !time24.includes(':')) return time24;
  if (time24.toLowerCase().includes('am') || time24.toLowerCase().includes('pm')) return time24;
  const [h, m] = time24.split(':');
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};

const formatTime12To24 = (time12) => {
  if (!time12 || !time12.includes(' ')) return time12;
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

const getUpcomingTasks = (todos) => {
  if (!todos) return [];
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  return todos.filter(todo => {
    if (todo.completed || !todo.time || (todo.date && todo.date !== '25 Sun')) return false;
    const match = todo.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return false;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    
    if (hours === 12) hours = 0;
    if (ampm === 'PM') hours += 12;
    
    const taskTotalMinutes = hours * 60 + minutes;
    const diff = taskTotalMinutes - currentTotalMinutes;
    
    return diff > 0 && diff <= 60;
  });
};

const checkIsOverdue = (todo) => {
  if (todo.completed) return false;
  const pastDates = ['23 Fri', '24 Sat'];
  if (pastDates.includes(todo.date)) return true;
  if ((todo.date === '25 Sun' || !todo.date) && todo.time) {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const match = todo.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (hours === 12) hours = 0;
      if (ampm === 'PM') hours += 12;
      const taskTotalMinutes = hours * 60 + minutes;
      if (taskTotalMinutes < currentTotalMinutes) {
        return true;
      }
    }
  }
  return false;
};

export default function TodoList() {
  const navigate = useNavigate();
  const email = localStorage.getItem('userEmail');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalTitle, setModalTitle] = useState('');
  const [modalPriority, setModalPriority] = useState('Low');
  const [modalTime, setModalTime] = useState('10:00 AM');
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedDate, setSelectedDate] = useState('25 Sun');
  const [toastMessage, setToastMessage] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const TABS = ['All', 'To do', 'Done'];

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  const { data, loading, error } = useQuery(GET_TODOS, {
    skip: !email,
    fetchPolicy: 'cache-and-network',
  });

  const [createTodo] = useMutation(CREATE_TODO, {
    refetchQueries: [{ query: GET_TODOS }],
  });
  
  const [updateTodoTitle] = useMutation(UPDATE_TODO_TITLE);
  const [toggleTodo] = useMutation(TOGGLE_TODO);
  
  const [deleteTodo] = useMutation(DELETE_TODO, {
    update(cache, { data: { deleteTodo } }, { variables }) {
      if (!deleteTodo) return;
      cache.modify({
        fields: {
          todos(existingTodos, { readField }) {
            return existingTodos.filter(
              todoRef => readField('id', todoRef) !== variables.id
            );
          }
        }
      });
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  };

  const openCreateModal = () => {
    setModalMode('create');
    setModalTitle('');
    setModalPriority('Low');
    const now = new Date();
    setModalTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (todo) => {
    setModalMode('edit');
    setModalTitle(todo.title);
    setModalPriority(todo.priority || 'Low');
    setModalTime(formatTime12To24(todo.time || '10:00 AM'));
    setEditingId(todo.id);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;
    const finalTime = formatTime24To12(modalTime);
    try {
      if (modalMode === 'create') {
        await createTodo({ variables: { title: modalTitle, priority: modalPriority, time: finalTime, date: selectedDate } });
      } else if (modalMode === 'edit' && editingId) {
        await updateTodoTitle({ variables: { id: editingId, title: modalTitle, priority: modalPriority, time: finalTime, date: selectedDate } });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id) => {
    setTaskToDelete(id);
  };

  if (!email) return null;

  return (
    <div className="relative min-h-screen overflow-hidden flex justify-center pb-24 font-sans bg-slate-50">
      {/* Professional subtle slate background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200"></div>

      {/* Seamless glass overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-[480px] flex flex-col h-screen overflow-hidden px-8">
        
        {/* Header Section */}
        <div className="pt-10 pb-2">
          {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button onClick={handleLogout} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 text-gray-700 hover:bg-gray-50 transition">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Today's Tasks</h1>
          <button 
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 text-gray-700 relative hover:bg-gray-50 transition"
          >
            <Bell size={20} />
            {(getUpcomingTasks(data?.todos).length > 0 || data?.todos?.some(t => checkIsOverdue(t))) && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-purple-600 rounded-full border border-white animate-pulse"></div>
            )}
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex justify-between mb-8 overflow-hidden">
          {['23 Fri', '24 Sat', '25 Sun', '26 Mon', '27 Tue'].map((date) => {
            const isSelected = date === selectedDate;
            const [dayNum, dayText] = date.split(' ');
            return (
              <button 
                key={date} 
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center w-14 h-20 rounded-full ${isSelected ? 'bg-[#6236FF] text-white shadow-lg shadow-[#6236FF]/30' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'} transition-all`}
              >
                <span className={`text-[10px] font-medium mb-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>May</span>
                <span className={`text-lg font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-800'}`}>{dayNum}</span>
                <span className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>{dayText}</span>
              </button>
            );
          })}
        </div>

        {/* Functional Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-[#6236FF] text-white shadow-md shadow-[#6236FF]/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        </div>

        <div className="pb-8 flex-1 overflow-y-auto scrollbar-hide">
          {loading && <div className="text-center py-8 text-gray-500 text-sm font-medium">Loading tasks...</div>}
          {error && <div className="text-red-500 p-4 bg-red-50/80 rounded-xl mb-6 text-sm">{error.message}</div>}

          {/* Task List */}
          <div className="space-y-4">
          {[...(data?.todos || [])]
            .filter(todo => (todo.date || '25 Sun') === selectedDate)
            .filter(todo => {
              if (activeTab === 'To do') return !todo.completed;
              if (activeTab === 'Done') return todo.completed;
              return true;
            })
            .sort((a, b) => {
              const priorityValue = { 'High': 3, 'Medium': 2, 'Low': 1 };
              return (priorityValue[b.priority] || 1) - (priorityValue[a.priority] || 1);
            })
            .map((todo) => {
              const isOverdue = checkIsOverdue(todo);
              return (
                <div 
                  key={todo.id} 
                  className={`group overflow-hidden flex flex-col p-5 rounded-[24px] shadow-sm border transition-all ${highlightedTaskId === todo.id ? 'ring-4 ring-purple-400 ring-opacity-50 scale-[1.02]' : ''} ${todo.completed ? 'bg-white/50 opacity-60 border-white/20' : isOverdue ? 'bg-red-50/60 border-red-200/50' : 'bg-white/80 border-white/60 hover:shadow-lg hover:bg-white'}`}
                >
              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col pr-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${todo.priority === 'High' ? 'text-red-500' : todo.priority === 'Medium' ? 'text-orange-500' : 'text-gray-400'}`}>
                    {todo.priority || 'Low'} Priority
                  </span>
                  <button 
                    onClick={() => toggleTodo({ variables: { id: todo.id } })}
                    className="text-left"
                  >
                    <span className={`text-base transition-colors ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-800 font-bold'}`}>
                      {todo.title}
                    </span>
                  </button>
                </div>
                
                <button 
                  onClick={() => toggleTodo({ variables: { id: todo.id } })}
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${todo.completed ? 'bg-[#10b981]' : 'bg-gray-100'}`}
                >
                  {todo.completed && <Check size={14} className="text-white" strokeWidth={3} />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <span className="text-[11px] font-medium">{todo.time || '10:00 AM'}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Edit Button */}
                  <button 
                    onClick={() => openEditModal(todo)}
                    className="p-1.5 text-gray-400 hover:text-[#6236FF] hover:bg-purple-50 rounded-full transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDelete(todo.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  {/* Toggle Status Button */}
                  <button 
                    onClick={() => toggleTodo({ variables: { id: todo.id } })}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold ml-1 transition-all shadow-sm active:scale-95 ${todo.completed ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-[#6236FF] text-white hover:bg-[#5225e5] hover:shadow-[#6236FF]/30 hover:shadow-lg'}`}
                  >
                    {todo.completed ? 'Undo (Mark To-Do)' : 'Mark as Done'}
                  </button>
                </div>
              </div>
            </div>
            );
          })}
          
          {data?.todos?.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white/40 border border-dashed border-gray-400/30 rounded-3xl text-gray-500">
              <p className="text-sm font-medium">You don't have any tasks yet.</p>
              <p className="text-xs mt-1">Add one to get started.</p>
            </div>
          ) : data?.todos?.filter(todo => {
            if (activeTab === 'To do') return !todo.completed;
            if (activeTab === 'Done') return todo.completed;
            return true;
          }).length === 0 ? (
            <div className="text-center py-12 px-6 bg-white/50 border border-dashed border-gray-200 rounded-3xl text-gray-400">
              <p className="text-sm font-medium">No tasks found for this filter.</p>
            </div>
          ) : null}
        </div>
      </div>

    {/* Floating Add Button */}
      <div className="fixed bottom-12 left-0 right-0 pointer-events-none flex justify-center z-40">
         <button 
           onClick={openCreateModal}
           className="w-16 h-16 bg-[#6236FF] rounded-full flex items-center justify-center shadow-2xl shadow-[#6236FF]/50 pointer-events-auto hover:scale-110 active:scale-95 transition-transform"
         >
           <Plus size={32} className="text-white" strokeWidth={2.5} />
         </button>
      </div>

      {/* Popup Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === 'create' ? 'Create New Task' : 'Edit Task'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 bg-gray-100 text-gray-500 hover:text-gray-800 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveModal}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Task Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="E.g., Finish project presentation"
                  className="w-full px-5 py-4 bg-gray-100 border-none rounded-3xl focus:outline-none focus:ring-2 focus:ring-[#6236FF] transition-all text-[15px]"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Time</label>
                <div className="relative">
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-100 border-none rounded-3xl focus:outline-none focus:ring-2 focus:ring-[#6236FF] transition-all text-[15px]"
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                <div className="flex gap-2">
                  {['Low', 'Medium', 'High'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${modalPriority === p ? (p === 'High' ? 'bg-red-50 text-red-600 border-red-200' : p === 'Medium' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-100 text-gray-700 border-gray-300') : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={!modalTitle.trim()}
                className="w-full bg-[#6236FF] hover:bg-[#5225e5] text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-[#6236FF]/20 active:scale-[0.98] disabled:opacity-50"
              >
                {modalMode === 'create' ? 'Save Task' : 'Update Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Task</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setTaskToDelete(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  deleteTodo({ variables: { id: taskToDelete } });
                  setTaskToDelete(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition shadow-lg shadow-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              <button 
                onClick={() => setIsNotificationsOpen(false)}
                className="p-1.5 bg-gray-100 text-gray-500 hover:text-gray-800 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              {(() => {
                const upcoming = getUpcomingTasks(data?.todos);
                const overdue = data?.todos?.filter(t => checkIsOverdue(t)) || [];
                if (upcoming.length === 0 && overdue.length === 0) {
                  return <p className="text-gray-500 text-center py-4">No new notifications.</p>;
                }
                return (
                  <>
                    {upcoming.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming</h3>
                        {upcoming.map(t => (
                          <button 
                            key={t.id}
                            onClick={() => {
                              setSelectedDate(t.date || '25 Sun');
                              setHighlightedTaskId(t.id);
                              setIsNotificationsOpen(false);
                              setTimeout(() => setHighlightedTaskId(null), 3000);
                            }}
                            className="w-full text-left bg-purple-50 p-3 rounded-xl mb-2 hover:bg-purple-100 transition"
                          >
                            <p className="font-bold text-purple-700 text-sm truncate">{t.title}</p>
                            <p className="text-xs text-purple-500 mt-0.5">Due in less than 1 hour</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {overdue.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Overdue</h3>
                        {overdue.map(t => (
                          <button 
                            key={t.id}
                            onClick={() => {
                              setSelectedDate(t.date || '25 Sun');
                              setHighlightedTaskId(t.id);
                              setIsNotificationsOpen(false);
                              setTimeout(() => setHighlightedTaskId(null), 3000);
                            }}
                            className="w-full text-left bg-red-50 p-3 rounded-xl mb-2 hover:bg-red-100 transition"
                          >
                            <p className="font-bold text-red-700 text-sm truncate">{t.title}</p>
                            <p className="text-xs text-red-500 mt-0.5">Time has passed</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
