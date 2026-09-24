import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import TodoList from './components/TodoList';

const httpLink = createHttpLink({
  uri: 'http://localhost:4000/',
});

const authLink = setContext((_, { headers }) => {
  const email = localStorage.getItem('userEmail');
  return {
    headers: {
      ...headers,
      authorization: email ? email : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/todos" element={<TodoList />} />
            <Route path="*" element={<Navigate to="/todos" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ApolloProvider>
  )
}

export default App;
