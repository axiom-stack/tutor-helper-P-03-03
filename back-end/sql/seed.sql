-- Seed data for Tutor Helper application

-- Insert users (teachers and students)
INSERT INTO Users (username, password, role) VALUES
('admin', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'admin'),
('john_doe', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher'),
('sarah_smith', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher'),
('mike_johnson', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher'),
('emily_brown', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher'),
('david_wilson', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher'),
('lisa_garcia', '$2a$10$rnn6QKsH7VHgJ3TKzAuyk.8P5WW7Yb4/PWA1XF6XCzErrr5ZuJ2dO', 'teacher');

-- Insert classes
INSERT INTO Classes (
  name,
  description,
  grade_label,
  section_label,
  academic_year,
  default_duration_minutes,
  teacher_id
) VALUES
('Mathematics 101', 'Introduction to basic mathematics concepts', 'Grade 8', 'A', '2025-2026', 45, 2), -- john_doe
('English Literature', 'Study of classic and modern literature', 'Grade 9', 'B', '2025-2026', 45, 3), -- sarah_smith
('Physics Fundamentals', 'Basic principles of physics', 'Grade 10', 'A', '2025-2026', 50, 4), -- mike_johnson
('Chemistry Basics', 'Introduction to chemical principles', 'Grade 10', 'B', '2025-2026', 50, 5), -- emily_brown
('History of World Civilizations', 'Comprehensive world history course', 'Grade 11', 'A', '2025-2026', 45, 6), -- david_wilson
('Computer Science Introduction', 'Programming fundamentals and algorithms', 'Grade 11', 'C', '2025-2026', 50, 7); -- lisa_garcia

-- Insert subjects for each class
INSERT INTO Subjects (class_id, teacher_id, name, description) VALUES
-- Mathematics 101 subjects
(1, 2, 'Algebra', 'Linear equations, quadratic equations, and systems'),
(1, 2, 'Geometry', 'Shapes, angles, theorems, and geometric proofs'),
(1, 2, 'Calculus', 'Limits, derivatives, and integrals'),

-- English Literature subjects
(2, 3, 'Shakespeare Studies', 'Analysis of Shakespeare''s major works'),
(2, 3, 'American Literature', 'Key works from American authors'),
(2, 3, 'Poetry Analysis', 'Understanding poetic devices and forms'),

-- Physics Fundamentals subjects
(3, 4, 'Mechanics', 'Motion, forces, and energy'),
(3, 4, 'Thermodynamics', 'Heat, temperature, and energy transfer'),
(3, 4, 'Electricity and Magnetism', 'Electric fields, circuits, and magnetic forces'),

-- Chemistry Basics subjects
(4, 5, 'Organic Chemistry', 'Carbon compounds and reactions'),
(4, 5, 'Inorganic Chemistry', 'Non-carbon compounds and periodic table'),
(4, 5, 'Physical Chemistry', 'Chemical kinetics and equilibrium'),

-- History subjects
(5, 6, 'Ancient Civilizations', 'Mesopotamia, Egypt, Greece, and Rome'),
(5, 6, 'Medieval History', 'Middle Ages and feudal systems'),
(5, 6, 'Modern History', 'Industrial revolution to present day'),

-- Computer Science subjects
(6, 7, 'Programming Fundamentals', 'Variables, loops, and basic algorithms'),
(6, 7, 'Data Structures', 'Arrays, lists, stacks, and queues'),
(6, 7, 'Algorithms', 'Sorting, searching, and complexity analysis');

-- Insert units for each subject
INSERT INTO Units (subject_id, teacher_id, name, description) VALUES
-- Algebra units (subject_id 1)
(1, 2, 'Linear Equations', 'Solving single and multi-variable linear equations'),
(1, 2, 'Quadratic Equations', 'Factoring, completing the square, and quadratic formula'),
(1, 2, 'Systems of Equations', 'Solving systems using substitution and elimination'),

-- Geometry units (subject_id 2)
(2, 2, 'Basic Shapes', 'Triangles, quadrilaterals, and circles'),
(2, 2, 'Geometric Proofs', 'Logic and reasoning in geometry'),
(2, 2, 'Coordinate Geometry', 'Points, lines, and planes in coordinate systems'),

-- Shakespeare Studies units (subject_id 4)
(4, 3, 'Tragedies', 'Hamlet, Macbeth, and Othello analysis'),
(4, 3, 'Comedies', 'A Midsummer Night''s Dream and The Tempest'),
(4, 3, 'Sonnets', 'Shakespeare''s poetic works and themes'),

-- Mechanics units (subject_id 7)
(7, 4, 'Kinematics', 'Motion without considering forces'),
(7, 4, 'Dynamics', 'Forces and Newton''s laws of motion'),
(7, 4, 'Work and Energy', 'Conservation of energy principles'),

-- Organic Chemistry units (subject_id 10)
(10, 5, 'Hydrocarbons', 'Alkanes, alkenes, and alkynes'),
(10, 5, 'Functional Groups', 'Common organic functional groups'),
(10, 5, 'Organic Reactions', 'Common reaction mechanisms'),

-- Programming Fundamentals units (subject_id 16)
(16, 7, 'Variables and Data Types', 'Understanding data storage and manipulation'),
(16, 7, 'Control Structures', 'Conditionals, loops, and program flow'),
(16, 7, 'Functions', 'Code organization and reusability');

-- Insert lessons for each unit
INSERT INTO Lessons (unit_id, teacher_id, name, description, content) VALUES
-- Linear Equations lessons (unit_id 1)
(1, 2, 'Solving One-Variable Equations', 'Step-by-step guide to solving linear equations', 'Learn how to isolate variables using inverse operations. Examples include 2x + 5 = 17 and 3(x - 2) = 12.'),
(1, 2, 'Word Problems', 'Translating word problems into equations', 'Practice converting real-world scenarios into mathematical equations and solving them.'),

-- Quadratic Equations lessons (unit_id 2)
(2, 2, 'Factoring Quadratics', 'Breaking down quadratic expressions', 'Methods for factoring trinomials and difference of squares. Practice problems included.'),
(2, 2, 'Quadratic Formula', 'The universal solution method', 'Derivation and application of the quadratic formula with examples and practice.'),

-- Basic Shapes lessons (unit_id 4)
(4, 2, 'Triangles and Their Properties', 'Types of triangles and angle relationships', 'Equilateral, isosceles, scalene triangles. Sum of interior angles equals 180 degrees.'),
(4, 2, 'Circles and Circumference', 'Properties of circles', 'Radius, diameter, circumference formulas. Pi and its applications.'),

-- Tragedies lessons (unit_id 7)
(7, 3, 'Hamlet: Themes and Characters', 'Deep dive into Shakespeare''s most famous tragedy', 'Analysis of the main characters, themes of madness and revenge, and key soliloquies.'),
(7, 3, 'Macbeth: Ambition and Fate', 'The corrupting influence of power', 'How the witches'' prophecies drive Macbeth''s tragic downfall.'),

-- Kinematics lessons (unit_id 10)
(10, 4, 'Position and Displacement', 'Understanding motion in one dimension', 'Scalars vs vectors, distance vs displacement, and position-time graphs.'),
(10, 4, 'Velocity and Acceleration', 'Rates of change in motion', 'Average vs instantaneous velocity, acceleration calculations, and motion equations.'),

-- Hydrocarbons lessons (unit_id 13)
(13, 5, 'Alkanes: Structure and Naming', 'The simplest organic compounds', 'Carbon chain structures, IUPAC naming conventions, and isomerism.'),
(13, 5, 'Alkenes and Alkynes', 'Unsaturated hydrocarbons', 'Double and triple bonds, geometric isomers, and addition reactions.'),

-- Variables and Data Types lessons (unit_id 19)
(19, 7, 'Primitive Data Types', 'Basic building blocks of programming', 'Integers, floats, booleans, characters, and strings. Memory allocation and ranges.'),
(19, 7, 'Type Conversion', 'Converting between data types', 'Implicit vs explicit casting, common conversion patterns, and potential pitfalls.'),

-- Control Structures lessons (unit_id 20)
(20, 7, 'Conditional Statements', 'Making decisions in code', 'If-else statements, switch cases, and nested conditionals with practical examples.'),
(20, 7, 'Looping Constructs', 'Repeating code execution', 'For loops, while loops, do-while loops, and when to use each type.'),

-- Functions lessons (unit_id 21)
(21, 7, 'Function Definition and Calling', 'Creating reusable code blocks', 'Parameters, return values, scope, and function signatures.'),
(21, 7, 'Recursion', 'Functions that call themselves', 'Base cases, recursive cases, and common recursive algorithms like factorial.');
