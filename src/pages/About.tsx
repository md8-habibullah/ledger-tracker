import { Github, Globe, User, Code, ShieldCheck, Heart } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const About = () => {
    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-4 mb-10">
                    <h1 className="text-4xl font-bold tracking-tight">
                        About <span className="text-gradient">Ledger Tracker</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        A secure, offline-first personal finance tracker designed to help you take control of your financial journey.
                    </p>
                </div>

                {/* Developer Profile Card */}
                <Card className="glass border-border/50 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />
                    <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* Avatar / Icon Placeholder */}
                            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-background shadow-xl overflow-hidden">
                                <img 
                                    src="https://avatars.githubusercontent.com/md8-habibullah?s=100" 
                                    alt="MD: HABIBULLAH SHARIF"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                <User className="h-16 w-16 text-primary hidden" />
                            </div>

                            <div className="flex-1 text-center md:text-left space-y-4">
                                <div>
                                    <h2 className="text-2xl font-bold">MD: HABIBULLAH SHARIF</h2>
                                    <p className="text-primary font-medium">Full-Stack & DevOps Engineer</p>
                                </div>

                                <p className="text-muted-foreground">
                                    Passionate about building useful tools that solve real-world problems.
                                    Ledger Tracker was created to provide a simple, privacy-focused way for people in Bangladesh and beyond to track their daily finances.
                                </p>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                                    <a href="https://habibullah.dev" target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="gap-2 border-border/50 hover:bg-primary/10 hover:text-primary">
                                            <Globe className="h-4 w-4" />
                                            habibullah.dev
                                        </Button>
                                    </a>
                                    <a href="https://github.com/md8-habibullah/ledger-tracker.git" target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="gap-2 border-border/50 hover:bg-secondary/10 hover:text-secondary">
                                            <Github className="h-4 w-4" />
                                            View Source Code
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="glass border-border/50">
                        <CardHeader>
                            <ShieldCheck className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>Privacy First</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                Your data stays on your device. We use IndexedDB technology to ensure your financial records are secure and offline-accessible.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card className="glass border-border/50">
                        <CardHeader>
                            <Code className="h-10 w-10 text-secondary mb-2" />
                            <CardTitle>Modern Tech</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                Built with React, TypeScript, and Tailwind CSS for a smooth, responsive, and beautiful user experience.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card className="glass border-border/50">
                        <CardHeader>
                            <Heart className="h-10 w-10 text-red-500 mb-2" />
                            <CardTitle>Open Source</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                This project is open source. Feel free to contribute, suggest features, or use it to learn more about web development.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground pt-8">
                    <p>© {new Date().getFullYear()} Ledger Tracker. Made in Bangladesh.</p>
                </div>
            </div>
        </MainLayout>
    );
};

export default About;
