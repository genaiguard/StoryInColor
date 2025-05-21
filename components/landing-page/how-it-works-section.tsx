import { Camera, Book, Download } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

export default function HowItWorksSection() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  // Create subtle rotation effects based on scroll
  const rotate1 = useTransform(scrollYProgress, [0, 1], [-5, 5])
  const rotate2 = useTransform(scrollYProgress, [0, 1], [5, -5])
  const rotate3 = useTransform(scrollYProgress, [0, 1], [-3, 3])

  // Scale effect for the entire section
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1])
  
  // Title animation variants
  const titleVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  }

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 100,
      rotateX: 45, 
      transformPerspective: 1000
    },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 80,
        delay: 0.2 * i
      }
    })
  }

  const iconVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: "spring",
        damping: 10,
        stiffness: 200,
        delay: 0.2
      }
    }
  }

  const textVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        delay: 0.3,
        duration: 0.5
      }
    }
  }

  return (
    <section 
      id="how-it-works" 
      ref={sectionRef} 
      className="bg-gray-50 py-12 md:py-16 lg:py-20 overflow-hidden"
    >
      <motion.div 
        style={{ scale }}
        className="container mx-auto max-w-7xl px-4 md:px-6"
      >
        <motion.div 
          variants={titleVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center justify-center space-y-4 text-center"
        >
          <motion.h2 
            className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl"
          >
            How It Works
          </motion.h2>
          <motion.p 
            className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed"
          >
            Transform your cherished memories into custom coloring pages in just three simple steps
          </motion.p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
          <motion.div 
            custom={0}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ 
              y: -15, 
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              transition: { type: "spring", stiffness: 300, damping: 15 }
            }}
            style={{ rotateY: rotate1 }}
            className="flex flex-col items-center space-y-4 rounded-2xl border bg-white p-8 shadow-sm"
          >
            <motion.div 
              variants={iconVariants}
              className="rounded-full bg-orange-100 p-6"
            >
              <Camera className="h-8 w-8 text-orange-500" />
            </motion.div>
            <motion.div variants={textVariants}>
              <h3 className="text-2xl font-bold text-center">1. Upload Photos</h3>
              <p className="text-center text-gray-500 mt-2">
                Upload your vacation photos, family pictures, or any special memories you want to transform.
              </p>
            </motion.div>
          </motion.div>

          <motion.div 
            custom={1}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ 
              y: -15, 
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              transition: { type: "spring", stiffness: 300, damping: 15 }
            }}
            style={{ rotateY: rotate2 }}
            className="flex flex-col items-center space-y-4 rounded-2xl border bg-white p-8 shadow-sm"
          >
            <motion.div 
              variants={iconVariants}
              className="rounded-full bg-purple-100 p-6"
            >
              <Book className="h-8 w-8 text-purple-500" />
            </motion.div>
            <motion.div variants={textVariants}>
              <h3 className="text-2xl font-bold text-center">2. Preview & Customize</h3>
              <p className="text-center text-gray-500 mt-2">
                Our AI converts your photos into coloring pages. Preview and make adjustments to get the best results.
              </p>
            </motion.div>
          </motion.div>

          <motion.div 
            custom={2}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ 
              y: -15, 
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              transition: { type: "spring", stiffness: 300, damping: 15 }
            }}
            style={{ rotateY: rotate3 }}
            className="flex flex-col items-center space-y-4 rounded-2xl border bg-white p-8 shadow-sm"
          >
            <motion.div 
              variants={iconVariants}
              className="rounded-full bg-pink-100 p-6"
            >
              <Download className="h-8 w-8 text-pink-500" />
            </motion.div>
            <motion.div variants={textVariants}>
              <h3 className="text-2xl font-bold text-center">3. Download Your Pages</h3>
              <p className="text-center text-gray-500 mt-2">
                Download your personalized coloring pages instantly and print them at home for immediate enjoyment.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

