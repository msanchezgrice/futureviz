'use client';

import React from 'react';
import Link from 'next/link';
import '../globals.css';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      color: 'white',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <header style={{
          textAlign: 'center',
          marginBottom: '80px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <img src="/favicon.svg" width={48} height={48} alt="Futureline logo" />
            <h1 style={{
              fontSize: '48px',
              fontWeight: 700,
              margin: 0,
              background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Futureline
            </h1>
          </div>
          <p style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '32px',
            fontWeight: 300
          }}>
            Visualize your family's future, year by year
          </p>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 20px rgba(96, 165, 250, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(96, 165, 250, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(96, 165, 250, 0.3)';
            }}>
              Get Started
            </button>
          </Link>
        </header>

        {/* What is Futureline */}
        <section style={{
          marginBottom: '80px',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 600,
            marginBottom: '24px',
            color: '#60a5fa'
          }}>
            What is Futureline?
          </h2>
          <p style={{
            fontSize: '18px',
            lineHeight: '1.8',
            color: 'rgba(255,255,255,0.75)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            Futureline helps you plan and visualize your family's future timeline. Map out where you'll live,
            when your kids will start school, major life events, and see it all in an interactive timeline.
            Add AI-generated images to bring your future to life and create vision boards for each year.
          </p>
        </section>

        {/* Features Grid */}
        <section style={{
          marginBottom: '80px'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 600,
            marginBottom: '48px',
            textAlign: 'center',
            color: '#34d399'
          }}>
            Key Features
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px'
          }}>
            <FeatureCard
              icon="👨‍👩‍👧‍👦"
              title="Family Planning"
              description="Track your family members' ages, milestones like starting school, and watch everyone grow up together year by year."
            />
            <FeatureCard
              icon="🌎"
              title="City Planning"
              description="Plan where you'll live over the years. Map out moves, relocations, and see how your location changes over time."
            />
            <FeatureCard
              icon="🎯"
              title="Life Events"
              description="Add recurring experiences like family vacations, sabbaticals, or any special events you want to plan for."
            />
            <FeatureCard
              icon="🎬"
              title="AI Timeline"
              description="Generate AI-powered images for each year showing your family in different life stages and locations."
            />
            <FeatureCard
              icon="📝"
              title="Daily Journaling"
              description="Write about typical days in each year. Describe your work day, family time, weekends, and special occasions."
            />
            <FeatureCard
              icon="🎨"
              title="Vision Boards"
              description="Create AI-generated vision boards for each day type to visualize what your ideal life looks like."
            />
          </div>
        </section>

        {/* How It Works */}
        <section style={{
          marginBottom: '80px'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 600,
            marginBottom: '48px',
            textAlign: 'center',
            color: '#60a5fa'
          }}>
            How It Works
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <Step
              number="1"
              title="Set Up Your Family"
              description="Add family members, their ages, and roles. Include yourself, partner, kids, or any relatives."
            />
            <Step
              number="2"
              title="Plan Your Journey"
              description="Map out cities you'll live in, recurring experiences, and adjust your time horizon (5-80 years)."
            />
            <Step
              number="3"
              title="Visualize Each Year"
              description="Browse your timeline year by year. See everyone's ages, location, and key milestones at a glance."
            />
            <Step
              number="4"
              title="Add Rich Details"
              description="Upload family photos, write journal entries for typical days, and generate AI images to bring it to life."
            />
          </div>
        </section>

        {/* Privacy & Storage */}
        <section style={{
          marginBottom: '80px',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 600,
            marginBottom: '24px',
            color: '#34d399'
          }}>
            100% Private & Local
          </h2>
          <p style={{
            fontSize: '18px',
            lineHeight: '1.8',
            color: 'rgba(255,255,255,0.75)',
            maxWidth: '800px',
            margin: '0 auto 32px'
          }}>
            Your plan is stored in your browser&apos;s local storage. When you use optional AI features
            (and provide your own API key), the relevant text/photo is sent to the Gemini API to
            generate outputs. Your family&apos;s future is yours and yours alone.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            <Badge icon="🔒" text="No Account Required" />
            <Badge icon="💾" text="Browser Storage Only" />
            <Badge icon="🔑" text="Your Own API Keys" />
            <Badge icon="🚫" text="No Data Collection" />
          </div>
        </section>

        {/* CTA */}
        <section style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(96, 165, 250, 0.1)',
          borderRadius: '20px',
          border: '1px solid rgba(96, 165, 250, 0.2)'
        }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '16px'
          }}>
            Ready to plan your future?
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.75)',
            marginBottom: '32px'
          }}>
            Start visualizing your family's journey today
          </p>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 20px rgba(96, 165, 250, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(96, 165, 250, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(96, 165, 250, 0.3)';
            }}>
              Launch Futureline
            </button>
          </Link>
        </section>

        {/* Footer */}
        <footer style={{
          marginTop: '80px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px'
        }}>
          <p>Futureline - Visualize Your Family's Future</p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '16px',
      padding: '32px',
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 8px 30px rgba(96, 165, 250, 0.2)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{
        fontSize: '22px',
        fontWeight: 600,
        marginBottom: '12px',
        color: '#60a5fa'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '16px',
        lineHeight: '1.6',
        color: 'rgba(255,255,255,0.7)',
        margin: 0
      }}>
        {description}
      </p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      alignItems: 'flex-start'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: 700,
        flexShrink: 0
      }}>
        {number}
      </div>
      <div>
        <h3 style={{
          fontSize: '22px',
          fontWeight: 600,
          marginBottom: '8px',
          color: '#34d399'
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: '16px',
          lineHeight: '1.6',
          color: 'rgba(255,255,255,0.7)',
          margin: 0
        }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function Badge({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 24px',
      background: 'rgba(52, 211, 153, 0.1)',
      borderRadius: '999px',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      fontSize: '16px',
      fontWeight: 500
    }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
