import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import '../../styles/bouncy-select.css';

const BouncySelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  return (
    <div className={`bouncy-select ${disabled ? 'is-disabled' : ''}`} ref={containerRef}>
      <div 
        className={`bouncy-select__trigger ${isOpen ? 'is-open' : ''}`} 
        onClick={toggleOpen}
      >
        <span className={value ? 'has-value' : 'is-placeholder'}>
          {selectedLabel}
        </span>
        <ChevronDown 
          size={20} 
          className={`bouncy-select__icon ${isOpen ? 'is-rotated' : ''}`} 
        />
      </div>

      <div className={`bouncy-select__menu-wrapper ${isOpen ? 'is-open' : ''}`}>
        <ul className="bouncy-select__menu">
          {options.map((option) => (
            <li
              key={option.value}
              className={`bouncy-select__item ${value === option.value ? 'is-selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BouncySelect;
