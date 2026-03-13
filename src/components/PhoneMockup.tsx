import React from 'react';

export const PhoneMockup: React.FC<{
  accentColor: string;
  messages: string[];
}> = ({accentColor, messages}) => {
  return (
    <div
      style={{
        width: 360,
        height: 620,
        borderRadius: 42,
        background: '#F7F9FC',
        border: '10px solid #0A0E13',
        boxShadow: '0 28px 60px rgba(0,0,0,0.4)',
        padding: 22,
        position: 'relative'
      }}
    >
      <div
        style={{
          width: 140,
          height: 24,
          borderRadius: 999,
          background: '#0A0E13',
          margin: '0 auto 24px'
        }}
      />
      <div style={{fontWeight: 800, fontSize: 24, color: '#111827'}}>小A问医生</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22}}>
        {messages.map((message, index) => (
          <div
            key={message}
            style={{
              alignSelf: index === 0 ? 'flex-start' : 'flex-end',
              maxWidth: 250,
              padding: '14px 16px',
              borderRadius: 18,
              background: index === 0 ? '#FFFFFF' : accentColor,
              color: index === 0 ? '#0F1720' : '#05251F',
              fontSize: 20,
              lineHeight: 1.4,
              boxShadow: '0 10px 18px rgba(15,23,32,0.08)'
            }}
          >
            {message}
          </div>
        ))}
      </div>
    </div>
  );
};
