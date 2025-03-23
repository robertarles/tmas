// src/App.tsx
import React, { useState, useEffect } from 'react';

type Status = {
  id: string;
  content: string;
  created_at: string; // Add created_at field
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
  };
};

const App = () => {
  const [instanceUrl, setInstanceUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [timeline, setTimeline] = useState<Status[]>([]);
  const [error, setError] = useState('');

  // Function to register your application with the Mastodon server.
  const registerApp = async () => {
    const response = await fetch(`${instanceUrl}/api/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: "Tauri Mastodon App",
        redirect_uris: "urn:ietf:wg:oauth:2.0:oob",
        scopes: "read write",
        website: "http://localhost"
      })
    });
    if (!response.ok) {
      throw new Error('Failed to register app');
    }
    const data = await response.json();
    return data; // Contains client_id and client_secret.
  };

  // Function to perform login using the password grant type.
  const loginToMastodon = async () => {
    try {
      // Step 1: Register the application.
      const appData = await registerApp();

      // Step 2: Request an access token using the registered credentials.
      const tokenResponse = await fetch(`${instanceUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: appData.client_id,
          client_secret: appData.client_secret,
          grant_type: "password",
          username,
          password,
          scope: "read write"
        })
      });
      if (!tokenResponse.ok) {
        throw new Error('Failed to obtain access token');
      }
      const tokenData = await tokenResponse.json();
      setAccessToken(tokenData.access_token);

      // Fetch the timeline after successful login.
      fetchTimeline(tokenData.access_token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Function to fetch the home timeline.
  const fetchTimeline = async (token: string) => {
    try {
      const timelineResponse = await fetch(`${instanceUrl}/api/v1/timelines/home`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!timelineResponse.ok) {
        throw new Error('Failed to fetch timeline');
      }
      const timelineData = await timelineResponse.json();
      setTimeline(timelineData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchTimeline(accessToken);
    }
  }, [accessToken]);

  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString(); // You can customize the format here
  };

  return (
    <div style={{ padding: '1rem' }}>
      {!accessToken ? (
        <div>
          <h2>Login to Mastodon</h2>
          <input
            type="text"
            placeholder="Mastodon Instance URL (e.g., https://fosstodon.org)"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <button onClick={loginToMastodon}>Login</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div>
          <h2>Your Timeline</h2>
          <div style={{
            maxHeight: '80vh',
            overflowY: 'scroll',
            border: '1px solid #ccc',
            padding: '1rem'
          }}>
            {timeline.map((status) => (
              <div key={status.id} style={{
                marginBottom: '1rem',
                borderBottom: '1px solid #eee',
                paddingBottom: '0.5rem'
              }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {status.account.display_name} (@{status.account.acct})
                  <span style={{ marginLeft: '1rem', color: 'grey', fontWeight: 'normal' }}>
                    {formatDate(status.created_at)}
                  </span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: status.content }} />
              </div>
            ))}
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default App;