"use client";
import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

const WhatsAppButton = () => {
  const [tilt, setTilt] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const triggerTilt = () => {
      // clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setTilt(true);

      // stop tilt after 600ms
      timeoutRef.current = setTimeout(() => {
        setTilt(false);
        timeoutRef.current = null;
      }, 600);
    };

    // trigger once at start
    triggerTilt();

    // repeat every 8 seconds
    intervalRef.current = setInterval(triggerTilt, 8000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes whatsapp-tilt {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          60% { transform: rotate(-6deg); }
          100% { transform: rotate(0deg); }
        }

        .whatsapp-tilt {
          animation: whatsapp-tilt 0.6s ease both;
        }
      `}</style>

      <div
        className="fixed bottom-6 right-6 z-50"
        style={{ overflow: "visible", pointerEvents: "auto" }}
      >
        <a
          href="https://wa.me/2348074602167?text=Hi%20AH%20Logistics!%20I'm%20from%20the%20website%20and%20I%20need%20assistance%20with%20"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            transformOrigin: "center",
            transform: "translateZ(0)",
            willChange: "transform",
            display: "inline-block",
          }}
          className={`bg-green-500 p-3 rounded-full shadow-lg transition-transform duration-200 ${
            tilt ? "whatsapp-tilt" : "hover:scale-105"
          }`}
          aria-label="Chat on WhatsApp"
        >
          <FaWhatsapp size={30} className="text-white" />
        </a>
      </div>
    </>
  );
};

export default WhatsAppButton;
