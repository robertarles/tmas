import React, { useState, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import './App.css';

type Status = {
  id: string;
  content: string;
  created_at: string;
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
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('mastodonAccessToken');
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
        client_name: 'tmas',
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
      // If running as a Tauri (macOS) app, use Tauri's shell API to open the URL; otherwise, open in a new browser tab
      if (__TAURI_INTERNALS__) {
        console.log("DEBUG REMOVE APP attempting open");
        await openUrl(authUrl);
      } else {
        console.log("DEBUG REMOVE WEB attempting open");
        await window.open(authUrl, '_blank');
      }
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
      localStorage.setItem('mastodonAccessToken', tokenData.access_token);
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
    const storedInstanceUrl = localStorage.getItem('mastodonInstanceUrl');
    if (storedInstanceUrl) {
      setInstanceUrl(storedInstanceUrl);
    }
  }, []);

  // Add this useEffect to update localStorage whenever instanceUrl changes
  useEffect(() => {
    if (instanceUrl) {
      localStorage.setItem('mastodonInstanceUrl', instanceUrl);
    }
  }, [instanceUrl]);
    const logout = () => {
      localStorage.removeItem('mastodonAccessToken');
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
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Your Timeline</h2>
            <div>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ background: 'none', border: 'none', color: '#80c0ff', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Menu
              </button>
              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    backgroundColor: '#3a3a3a',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    marginTop: '0.5rem'
                  }}
                >
                  <a
                    href="#"
                    onClick={() => { setShowDropdown(false); logout(); }}
                    style={{ color: '#80c0ff', textDecoration: 'none' }}
                  >
                    Logout
                  </a>
                </div>
              )}
            </div>
          </div>
          <div style={{
            maxHeight: '80vh',
            overflowY: 'scroll',
            overflowX: 'hidden',  // Added to hide horizontal scrollbar
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
                <div
                  style={{
                    overflowX: 'hidden',
                    wordWrap: 'break-word',
                    whiteSpace: 'normal'
                  }}
                  dangerouslySetInnerHTML={{ __html: status.content }}
                />
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