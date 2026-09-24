import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { JSONFilePreset } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';

const defaultData = { users: [], todos: [] };
const db = await JSONFilePreset('db.json', defaultData);

let needsWrite = false;
db.data.todos.forEach(todo => {
  if (todo.status !== undefined) {
    todo.completed = todo.status === 'Done';
    delete todo.status;
    needsWrite = true;
  }
  if (todo.priority === undefined) {
    todo.priority = 'Low';
    needsWrite = true;
  }
  if (todo.time === undefined) {
    todo.time = '10:00 AM';
    needsWrite = true;
  }
  if (todo.date === undefined) {
    todo.date = '25 Sun';
    needsWrite = true;
  }
});
if (needsWrite) await db.write();

const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
  }

  type Todo {
    id: ID!
    title: String!
    completed: Boolean!
    priority: String!
    time: String!
    date: String!
    userId: ID!
  }

  type Query {
    me: User
    todos: [Todo!]!
  }

  type Mutation {
    login(email: String!): User!
    signup(email: String!): User!
    createTodo(title: String!, priority: String!, time: String!, date: String!): Todo!
    deleteTodo(id: ID!): Boolean!
    toggleTodo(id: ID!): Todo!
    updateTodoTitle(id: ID!, title: String!, priority: String!, time: String!, date: String!): Todo!
  }
`;

const resolvers = {
  Query: {
    me: (_, __, context) => context.user,
    todos: (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      return db.data.todos.filter(t => t.userId === context.user.id);
    },
  },
  Mutation: {
    login: async (_, { email }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email cannot be empty');
      let user = db.data.users.find(u => u.email === normalizedEmail);
      if (!user) throw new Error('Account not found. Please sign up first.');
      return user;
    },
    signup: async (_, { email }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email cannot be empty');
      let user = db.data.users.find(u => u.email === normalizedEmail);
      if (user) throw new Error('Account already exists. Please sign in.');
      user = { id: uuidv4(), email: normalizedEmail };
      db.data.users.push(user);
      await db.write();
      return user;
    },
    createTodo: async (_, { title, priority, time, date }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      if (!title.trim()) throw new Error('Task title cannot be empty');
      const todo = {
        id: uuidv4(),
        title,
        completed: false,
        priority,
        time,
        date,
        userId: context.user.id,
      };
      db.data.todos.push(todo);
      await db.write();
      return todo;
    },
    deleteTodo: async (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const index = db.data.todos.findIndex(t => t.id === id && t.userId === context.user.id);
      if (index === -1) return false;
      db.data.todos.splice(index, 1);
      await db.write();
      return true;
    },
    toggleTodo: async (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const todo = db.data.todos.find(t => t.id === id && t.userId === context.user.id);
      if (!todo) throw new Error('Todo not found');
      todo.completed = !todo.completed;
      await db.write();
      return todo;
    },
    updateTodoTitle: async (_, { id, title, priority, time, date }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const todo = db.data.todos.find(t => t.id === id && t.userId === context.user.id);
      if (!todo) throw new Error('Todo not found');
      todo.title = title;
      todo.priority = priority;
      todo.time = time;
      todo.date = date;
      await db.write();
      return todo;
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000, host: '0.0.0.0' },
  context: async ({ req }) => {
    const email = req.headers.authorization || '';
    if (email) {
      const user = db.data.users.find(u => u.email === email);
      return { user };
    }
    return { user: null };
  },
});

console.log(`🚀  Server ready at: ${url}`);
