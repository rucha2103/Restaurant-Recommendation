export default function TestPage() {
  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>🚀 DEPLOYMENT TEST</h1>
      
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        padding: '2rem', 
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>If you can see this page, Vercel is working!</h2>
        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>This confirms our latest deployment is live.</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Deployed: {new Date().toLocaleString()}</p>
      </div>

      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        padding: '2rem', 
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Testing Dropdowns:</h3>
        <select style={{ 
          padding: '1rem', 
          fontSize: '1rem', 
          borderRadius: '8px', 
          border: 'none',
          marginRight: '1rem',
          background: 'white',
          color: '#333'
        }}>
          <option>BTM Layout</option>
          <option>Koramangala</option>
          <option>Indiranagar</option>
        </select>
        
        <select style={{ 
          padding: '1rem', 
          fontSize: '1rem', 
          borderRadius: '8px', 
          border: 'none',
          background: 'white',
          color: '#333'
        }}>
          <option>Chinese</option>
          <option>Italian</option>
          <option>Indian</option>
        </select>
      </div>

      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        padding: '2rem', 
        borderRadius: '12px'
      }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Testing Slider:</h3>
        <input 
          type="range" 
          min="0" 
          max="2" 
          defaultValue="1"
          style={{ 
            width: '300px', 
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.3)',
            outline: 'none'
          }} 
        />
        <p style={{ marginTop: '1rem' }}>Budget: Moderate</p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ 
          color: 'white', 
          textDecoration: 'underline',
          fontSize: '1.1rem'
        }}>
          ← Back to Main Page
        </a>
      </div>
    </div>
  );
}
