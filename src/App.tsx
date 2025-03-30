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
  const [accessToken, setAccessToken] = useState('');
  const [timeline, setTimeline] = useState<Status[]>([]);
  const [error, setError] = useState('');
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    const storedToken = sessionStorage.getItem('mastodonAccessToken');
    if (storedToken) {
      setAccessToken(storedToken);
    }
  }, []);

  // Function to register your application with the Mastodon server.
  const registerApp = async () => {
    const response = await fetch(`${instanceUrl}/api/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Tauri Mastodon App',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read write',
        website: 'http://localhost'
      })
    });
    if (!response.ok) {
      throw new Error('Failed to register app');
    }
    const data = await response.json();
    return data; // Contains client_id and client_secret.
  };

  // Function to initiate the OAuth flow using out-of-band authorization
  const startOauthFlow = async () => {
    try {
      // Register the application
      const appData = await registerApp();
      // Save app data to localStorage for use after manual code entry
      localStorage.setItem('mastodonAppData', JSON.stringify(appData));

      // Construct the authorization URL using out-of-band redirect URI
      const authUrl = `${instanceUrl}/oauth/authorize?client_id=${appData.client_id}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=read+write`;
      // Open the authorization URL in a new window
      window.open(authUrl, '_blank');
    } catch (err: any) {
      setError(`startOauthFlow: ${err.message}`);
    }
  };

  // Function to exchange the authorization code for an access token
  const exchangeCodeForToken = async (code: string) => {
    try {
      const storedAppData = localStorage.getItem('mastodonAppData');
      if (!storedAppData) {
        throw new Error('App data not found in local storage.');
      }
      let appData;
      try {
        appData = JSON.parse(storedAppData);
      } catch (e) {
        localStorage.removeItem('mastodonAppData');
        throw new Error('Stored app data is invalid. Please restart the authentication flow.');
      }
      const { client_id, client_secret } = appData;
      const tokenResponse = await fetch(`${instanceUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id,
          client_secret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
        })
      });
      if (!tokenResponse.ok) {
        throw new Error('Failed to obtain access token');
      }
      const tokenData = await tokenResponse.json();
      setAccessToken(tokenData.access_token);
      sessionStorage.setItem('mastodonAccessToken', tokenData.access_token);
      // Optionally, remove stored app data
      localStorage.removeItem('mastodonAppData');
    } catch (err: any) {
      setError(`exchangeCodeForToken: ${err}`);
    }
  };

  // Function to fetch the home timeline.
  const fetchTimeline = async (token: string) => {
    let timelineResponse;
    try {
      timelineResponse = await fetch(`${instanceUrl}/api/v1/timelines/home`, {
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
      setError(`fetchTimeline: ${err}`);
      console.error(err);
      console.error(timelineResponse)
    }
  };

  // Fetch timeline when accessToken is set
  useEffect(() => {
    if (accessToken) {
      fetchTimeline(accessToken);
    }
  }, [accessToken]);
  // Add this useEffect after the one that loads the access token
  useEffect(() => {
    const storedInstanceUrl = sessionStorage.getItem('mastodonInstanceUrl');
    if (storedInstanceUrl) {
      setInstanceUrl(storedInstanceUrl);
    }
  }, []);

  // Add this useEffect to update sessionStorage whenever instanceUrl changes
  useEffect(() => {
    if (instanceUrl) {
      sessionStorage.setItem('mastodonInstanceUrl', instanceUrl);
    }
  }, [instanceUrl]);
    const logout = () => {
      sessionStorage.removeItem('mastodonAccessToken');
      setAccessToken('');
      setTimeline([]);
    };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div style={{ padding: '1rem' }}>
      {!accessToken ? (
        <div>
          <h2>Login to Mastodon via Out-of-Band OAuth</h2>
          <input
            type="text"
            placeholder="Mastodon Instance URL (e.g., https://fosstodon.org)"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <button onClick={startOauthFlow}>Get Authorization Code</button>
          <br /><br />
          <input
            type="text"
            placeholder="Enter Authorization Code"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <button onClick={() => exchangeCodeForToken(authCode)}>Submit Authorization Code</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Your Timeline</h2>
            <a href="#" onClick={logout} style={{ textDecoration: 'none', fontSize: '0.9rem' }}>Logout</a>
          </div>
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