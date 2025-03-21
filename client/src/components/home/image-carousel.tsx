import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CarouselImage } from '@shared/schema';
import { Loader2 } from 'lucide-react';

export function ImageCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  
  const { data: images, isLoading } = useQuery<CarouselImage[]>({
    queryKey: ['/api/carousel'],
  });
  
  useEffect(() => {
    if (!images?.length) return;
    
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [images]);
  
  if (isLoading) {
    return (
      <div className="relative mx-4 mb-6 rounded-xl overflow-hidden h-40 flex items-center justify-center bg-dark-tertiary">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }
  
  if (!images?.length) {
    return (
      <div className="relative mx-4 mb-6 rounded-xl overflow-hidden h-40 flex items-center justify-center bg-dark-tertiary">
        <p className="text-gray-400">Sem imagens disponíveis</p>
      </div>
    );
  }
  
  return (
    <div className="relative mx-4 mb-6 rounded-xl overflow-hidden h-40 cyber-element">
      <div className="absolute inset-0 flex">
        {images.map((image, index) => (
          <img
            key={image.id}
            src={image.imageUrl}
            alt="Cybersecurity visual"
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
              index === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-1 p-2">
        {images.map((_, index) => (
          <span
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === activeIndex ? 'bg-white opacity-100' : 'bg-white opacity-50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
