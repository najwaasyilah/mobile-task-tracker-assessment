import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, Modal, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
import { gql, useQuery, useMutation } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const formatTime12 = (d) => {
  let hours = d.getHours();
  let minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
};

const parseTime12 = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return new Date();
  if (!timeStr.includes(' ')) return new Date();
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  if (!hours || !minutes) return new Date();
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const checkUpcomingTasks = (todos) => {
  if (!todos) return null;
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  for (const todo of todos) {
    if (todo.completed || !todo.time) continue;
    const match = todo.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) continue;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    
    if (hours === 12) hours = 0;
    if (ampm === 'PM') hours += 12;
    
    const taskTotalMinutes = hours * 60 + minutes;
    const diff = taskTotalMinutes - currentTotalMinutes;
    
    if (diff > 0 && diff <= 60) {
      return todo;
    }
  }
  return null;
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

const GET_TODOS = gql`
  query GetTodos {
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

export default function TodoListScreen({ navigation }) {
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalTitle, setModalTitle] = useState('');
  const [modalPriority, setModalPriority] = useState('Low');
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [modalTime, setModalTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('Today');
  const [selectedDate, setSelectedDate] = useState('25 Sun');
  const TABS = ['Today', 'Lists', 'Done'];
  
  const { data, loading, error, refetch } = useQuery(GET_TODOS, {
    fetchPolicy: 'cache-and-network',
  });

  const [createTodo] = useMutation(CREATE_TODO, {
    refetchQueries: [{ query: GET_TODOS }],
  });
  
  const [toggleTodo] = useMutation(TOGGLE_TODO);
  const [updateTodoTitle] = useMutation(UPDATE_TODO_TITLE);
  
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

  useEffect(() => {
    const checkAuth = async () => {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        navigation.replace('Login');
      }
    };
    checkAuth();
  }, [navigation]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userEmail');
    await AsyncStorage.removeItem('userId');
    navigation.replace('Login');
  };

  const openCreateModal = () => {
    setModalMode('create');
    setModalTitle('');
    setModalPriority('Low');
    setModalTime(new Date());
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (todo) => {
    setModalMode('edit');
    setModalTitle(todo.title);
    setModalPriority(todo.priority || 'Low');
    setModalTime(parseTime12(todo.time || '10:00 AM'));
    setEditingId(todo.id);
    setModalVisible(true);
  };

  const handleSaveModal = async () => {
    if (!modalTitle.trim()) return;
    const finalTime = formatTime12(modalTime);
    try {
      if (modalMode === 'create') {
        await createTodo({ variables: { title: modalTitle, priority: modalPriority, time: finalTime, date: selectedDate } });
      } else if (modalMode === 'edit' && editingId) {
        await updateTodoTitle({ variables: { id: editingId, title: modalTitle, priority: modalPriority, time: finalTime, date: selectedDate } });
      }
      setModalVisible(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", onPress: () => deleteTodo({ variables: { id } }), style: "destructive" }
      ]
    );
  };

  const renderItem = useCallback(({ item }) => {
    const isOverdue = checkIsOverdue(item);
    return (
      <View style={[
        styles.todoItem, 
        item.completed && styles.todoItemCompleted, 
        isOverdue && { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
        highlightedTaskId === item.id && styles.todoItemHighlighted
      ]}>
        <View style={styles.todoItemHeader}>
          <Text style={[styles.projectTag, item.priority === 'High' ? {color: '#ef4444'} : item.priority === 'Medium' ? {color: '#f97316'} : undefined]}>
            {(item.priority || 'Low').toUpperCase()} PRIORITY
          </Text>
        </View>
      <View style={styles.todoContentRow}>
        <TouchableOpacity 
          style={styles.todoTitleWrapper} 
          onPress={() => toggleTodo({ variables: { id: item.id } })}
        >
          <Text style={[styles.todoTitle, item.completed && styles.todoTitleCompleted]}>
            {item.title}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.checkbox, item.completed && styles.checkboxChecked]}
          onPress={() => toggleTodo({ variables: { id: item.id } })}
        >
          {item.completed && <Text style={styles.checkIcon}>✓</Text>}
        </TouchableOpacity>
      </View>
      
      <View style={styles.todoFooterRow}>
        <Text style={[styles.timeText, isOverdue && { color: '#ef4444', fontWeight: 'bold' }]}>
          🕒 {item.time || '10:00 AM'} {isOverdue && '(Overdue)'}
        </Text>
        <View style={styles.actionsWrapper}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDelete(item.id)}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statusBadge, item.completed ? styles.statusDone : styles.statusTodo]}
            onPress={() => toggleTodo({ variables: { id: item.id } })}
          >
            <Text style={[styles.statusText, item.completed ? styles.statusTextDone : styles.statusTextTodo]}>
              {item.completed ? 'Undo (To-Do)' : 'Mark as Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}, [toggleTodo, deleteTodo, openEditModal]);

  return (
    <View style={styles.screenWrapper}>
      <LinearGradient 
        colors={['#f8fafc', '#f1f5f9', '#e2e8f0']} 
        start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
        style={StyleSheet.absoluteFillObject} 
      />
      
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" style={{ marginLeft: -2 }} />
            </TouchableOpacity>
          <Text style={styles.headerTitle}>Today's Tasks</Text>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => {
              const upcoming = checkUpcomingTasks(data?.todos);
              if (upcoming) {
                Alert.alert('Upcoming Task!', `Navigating to "${upcoming.title}"`);
                setSelectedDate(upcoming.date || '25 Sun');
                setActiveTab('Lists');
                setHighlightedTaskId(upcoming.id);
                setTimeout(() => setHighlightedTaskId(null), 3000);
              } else {
                Alert.alert('Notifications', 'No new notifications');
              }
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="#374151" />
            {checkUpcomingTasks(data?.todos) && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.calendarStrip}>
          {['23 Fri', '24 Sat', '25 Sun', '26 Mon', '27 Tue'].map((date) => {
            const isSelected = date === selectedDate;
            const [dayNum, dayText] = date.split(' ');
            return (
              <TouchableOpacity 
                key={date} 
                onPress={() => setSelectedDate(date)}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
              >
                <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>May</Text>
                <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{dayNum}</Text>
                <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{dayText}</Text>
              </TouchableOpacity>
            );
          })}
        </View>



        {loading && <ActivityIndicator style={styles.loader} color="#6236FF" />}
        {error && <Text style={styles.errorText}>{error.message}</Text>}

        <FlatList
          data={[...(data?.todos || [])]
            .filter(todo => (todo.date || '25 Sun') === selectedDate)
            .filter(todo => {
              if (activeTab === 'Today') return !todo.completed;
              if (activeTab === 'Done') return todo.completed;
              return true;
            })
            .sort((a, b) => {
              const priorityValue = { 'High': 3, 'Medium': 2, 'Low': 1 };
              return (priorityValue[b.priority] || 1) - (priorityValue[a.priority] || 1);
            })}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {data?.todos?.length === 0 
                  ? "You don't have any tasks yet." 
                  : "No tasks found for this filter."}
              </Text>
            </View>
          }
        />
        
        <BlurView intensity={80} tint="light" style={styles.bottomNavBar}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Today')}>
            <Ionicons name="sunny-outline" size={24} color={activeTab === 'Today' ? '#6236FF' : '#6b7280'} />
            <Text style={[styles.navText, activeTab === 'Today' && styles.navTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => {
            Alert.alert("Upcoming", "Use the horizontal calendar above for now!");
          }}>
            <Ionicons name="calendar-outline" size={24} color="#6b7280" />
            <Text style={styles.navText}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Lists')}>
            <Ionicons name="list-outline" size={24} color={activeTab === 'Lists' ? '#6236FF' : '#6b7280'} />
            <Text style={[styles.navText, activeTab === 'Lists' && styles.navTextActive]}>Lists</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Done')}>
            <Ionicons name="checkmark-done-outline" size={24} color={activeTab === 'Done' ? '#6236FF' : '#6b7280'} />
            <Text style={[styles.navText, activeTab === 'Done' && styles.navTextActive]}>Done</Text>
          </TouchableOpacity>
        </BlurView>

        <TouchableOpacity style={styles.floatingButtonGreen} onPress={openCreateModal}>
          <Text style={styles.floatingButtonText}>+</Text>
        </TouchableOpacity>

        {/* Create / Edit Modal */}
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <BlurView intensity={70} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'create' ? 'Create New Task' : 'Edit Task'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalInputLabel}>Task Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="E.g., Finish project presentation"
                placeholderTextColor="#9ca3af"
                value={modalTitle}
                onChangeText={setModalTitle}
                autoFocus={true}
              />

              <Text style={styles.modalInputLabel}>Time</Text>
              <TouchableOpacity
                style={[styles.modalInput, { justifyContent: 'center' }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={{ color: '#000', fontSize: 16 }}>
                  {formatTime12(modalTime)}
                </Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={modalTime}
                  mode="time"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedDate) setModalTime(selectedDate);
                  }}
                />
              )}

              <Text style={styles.modalInputLabel}>Priority</Text>
              <View style={styles.priorityContainer}>
                {['Low', 'Medium', 'High'].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setModalPriority(p)}
                    style={[
                      styles.priorityButton,
                      modalPriority === p && (p === 'High' ? styles.priorityHigh : p === 'Medium' ? styles.priorityMedium : styles.priorityLow)
                    ]}
                  >
                    <Text style={[
                      styles.priorityText,
                      modalPriority === p && (p === 'High' ? styles.priorityTextHigh : p === 'Medium' ? styles.priorityTextMedium : styles.priorityTextLow)
                    ]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.modalSaveButton, !modalTitle.trim() && styles.modalSaveButtonDisabled]} 
                onPress={handleSaveModal}
                disabled={!modalTitle.trim()}
              >
                <Text style={styles.modalSaveText}>
                  {modalMode === 'create' ? 'Save Task' : 'Update Task'}
                </Text>
              </TouchableOpacity>
            </BlurView>
          </KeyboardAvoidingView>
        </Modal>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#f8fafc' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  blob: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.2 },
  glassContainer: { flex: 1, margin: 16, marginTop: 24, marginBottom: 24, borderRadius: 40, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 15 },
  backButton: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  backArrow: { fontSize: 20, color: '#374151' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  notificationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#6236FF', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  dateCard: { width: 56, height: 76, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  dateCardSelected: { backgroundColor: '#6236FF', borderColor: '#6236FF', shadowColor: '#6236FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  dateMonth: { fontSize: 10, color: '#4b5563', marginBottom: 4, fontWeight: '600' },
  dateNum: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 },
  dateDay: { fontSize: 10, color: '#4b5563', fontWeight: '500' },
  dateTextSelected: { color: '#fff' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', marginRight: 10 },
  tabActive: { backgroundColor: '#6236FF', shadowColor: '#6236FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  tabTextActive: { color: '#fff' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 120 },
  todoItem: { backgroundColor: 'rgba(255,255,255,0.85)', padding: 16, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  todoItemCompleted: { opacity: 0.6 },
  todoItemHighlighted: { borderColor: '#6236FF', borderWidth: 2, backgroundColor: '#fff', shadowColor: '#6236FF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  todoItemHeader: { marginBottom: 12 },
  projectTag: { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5 },
  todoContentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  todoTitleWrapper: { flex: 1, paddingRight: 12 },
  todoTitle: { fontSize: 17, fontWeight: 'bold', color: '#1f2937' },
  todoTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
  checkbox: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#10b981' },
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  todoFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  timeText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  actionsWrapper: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  editButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f5f3ff', borderRadius: 8 },
  editText: { color: '#6236FF', fontSize: 11, fontWeight: '600' },
  deleteButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fef2f2', borderRadius: 8 },
  deleteText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  statusDone: { backgroundColor: '#f3f4f6' },
  statusTodo: { backgroundColor: '#6236FF' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextDone: { color: '#6b7280' },
  statusTextTodo: { color: '#ffffff' },
  loader: { marginTop: 20 },
  errorText: { color: '#ef4444', textAlign: 'center', padding: 16 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  bottomNavBar: { position: 'absolute', bottom: 30, left: 20, right: 20, height: 70, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, overflow: 'hidden' },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 60 },
  navText: { fontSize: 10, color: '#6b7280', fontWeight: '600', marginTop: 4 },
  navTextActive: { color: '#6236FF', fontWeight: 'bold' },
  floatingButtonGreen: { position: 'absolute', bottom: 120, right: 30, width: 64, height: 64, backgroundColor: '#10b981', borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  floatingButtonText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalCloseButton: { width: 32, height: 32, backgroundColor: '#f3f4f6', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 16, color: '#6b7280', fontWeight: 'bold' },
  modalInputLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  modalInput: { backgroundColor: '#f3f4f6', borderWidth: 0, borderRadius: 24, padding: 16, fontSize: 16, color: '#111827', marginBottom: 24 },
  modalSaveButton: { backgroundColor: '#6236FF', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalSaveButtonDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  priorityContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  priorityButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  priorityText: { fontSize: 14, fontWeight: 'bold', color: '#9ca3af' },
  priorityLow: { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' },
  priorityTextLow: { color: '#374151' },
  priorityMedium: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  priorityTextMedium: { color: '#ea580c' },
  priorityHigh: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  priorityTextHigh: { color: '#dc2626' }
});
