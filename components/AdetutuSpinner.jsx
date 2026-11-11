import React from "react";

const AdetutuSpinner = ({ size = "text-xl", border = "border-black" }) => {
  return (
    <div className="flex justify-center items-center h-screen">
      <p
        className={`animate-spin font-bold rounded-full p-4 ${border} ${size} border`}
      >
        Adetutu <span className="text-red-500">Clothing</span>
      </p>
    </div>
  );
};

export default AdetutuSpinner;
