import { ImageIcon, Heart, Package, Camera, ChevronLeft, ChevronRight } from "lucide-react"
import { PathImg } from "@/components/ui/pathed-image"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { useRef, useState, useEffect } from "react"

export default function ExamplesSection() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const intervalRef = useRef(null)

  const imageScale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1])
  const imageRotate = useTransform(scrollYProgress, [0, 1], [-2, 2])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1])
  const titleY = useTransform(scrollYProgress, [0, 0.2], [50, 0])

  // Animation variants
  const fadeInVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 50
      }
    }
  }

  const categoryVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.05 * i,
        type: "spring",
        damping: 12,
        stiffness: 100
      }
    })
  }

  const slideVariants = {
    enter: (direction) => {
      return {
        x: direction > 0 ? 100 : -100,
        opacity: 0,
        scale: 0.98,
      };
    },
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 400, damping: 40 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 }
      }
    },
    exit: (direction) => {
      return {
        x: direction < 0 ? 100 : -100,
        opacity: 0,
        scale: 0.98,
        transition: {
          x: { type: "spring", stiffness: 400, damping: 40 },
          opacity: { duration: 0.3 },
          scale: { duration: 0.3 }
        }
      };
    }
  };

  const categories = [
    { icon: <ImageIcon className="h-5 w-5 text-blue-500" />, name: "Vacation Photos", bg: "bg-blue-100" },
    { icon: <Heart className="h-5 w-5 text-pink-500" />, name: "Wedding Memories", bg: "bg-pink-100" },
    { icon: <Package className="h-5 w-5 text-green-500" />, name: "Family Trips", bg: "bg-green-100" },
    { icon: <Camera className="h-5 w-5 text-orange-500" />, name: "Special Events", bg: "bg-orange-100" },
    { 
      icon: <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-purple-500"
              >
                <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" />
                <path d="M14.5 5.17c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.344-2.5" />
                <path d="M8 14v.5" />
                <path d="M16 14v.5" />
                <path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />
                <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" />
      </svg>, 
      name: "Beloved Pets", 
      bg: "bg-purple-100" 
    }
  ]

  const examples = [
    { src: "/images/example1.webp", alt: "Example coloring page 1" },
    { src: "/images/example2.webp", alt: "Example coloring page 2" },
    { src: "/images/example3.webp", alt: "Example coloring page 3" }
  ]

  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (isAutoPlaying) {
      intervalRef.current = setInterval(() => {
        setDirection(1);
        setCurrentIndex((prevIndex) => (prevIndex + 1) % examples.length);
      }, 4000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, examples.length]);

  const goToNext = () => {
    setIsAutoPlaying(false);
    setDirection(1);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % examples.length);
  };

  const goToPrev = () => {
    setIsAutoPlaying(false);
    setDirection(-1);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + examples.length) % examples.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  return (
    <section id="examples" ref={sectionRef} className="py-12 md:py-16 lg:py-20 overflow-hidden relative">
      {/* Background elements for visual interest */}
      <div className="absolute w-64 h-64 bg-orange-100 rounded-full opacity-30 blur-3xl -top-10 -left-20"></div>
      <div className="absolute w-96 h-96 bg-purple-100 rounded-full opacity-30 blur-3xl -bottom-40 -right-20"></div>
      
      <div className="container mx-auto max-w-7xl px-4 md:px-6 relative z-10">
        <motion.div 
          style={{ opacity: titleOpacity, y: titleY }}
          className="flex flex-col items-center justify-center space-y-4 text-center"
        >
          <motion.div
            variants={fadeInVariants} 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="space-y-2"
          >
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Perfect For Your Memories</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Create personalized coloring pages from your favorite moments
            </p>
          </motion.div>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-6 py-8">
          {categories.map((category, i) => (
            <motion.div 
              key={i}
              custom={i}
              variants={categoryVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ 
                scale: 1.1, 
                transition: { type: "spring", stiffness: 400, damping: 10 } 
              }}
              className="flex flex-col items-center gap-2"
            >
              <motion.div 
                className={`rounded-full ${category.bg} p-3`}
                whileHover={{ 
                  rotate: [0, 10, -10, 0],
                  transition: { duration: 0.5 }
                }}
              >
                {category.icon}
              </motion.div>
              <span className="text-sm font-medium">{category.name}</span>
            </motion.div>
          ))}
          </div>

        <motion.div 
          className="mt-16 relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInVariants}
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          <div className="relative overflow-hidden rounded-xl aspect-[4/3] md:aspect-[16/9] max-w-4xl mx-auto">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <div className="relative w-full h-full bg-transparent">
              <PathImg
                    src={examples[currentIndex].src}
                    alt={examples[currentIndex].alt}
                    fill
                    priority
                    className="object-contain"
              />
            </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            <button 
              onClick={goToPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/30 backdrop-blur-md hover:bg-white/50 text-gray-800 transition-colors duration-300"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button 
              onClick={goToNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/30 backdrop-blur-md hover:bg-white/50 text-gray-800 transition-colors duration-300"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center mt-4 space-x-2">
            {examples.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`w-3 h-3 rounded-full ${ 
                  i === currentIndex ? "bg-orange-500" : "bg-gray-300"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

