import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Eye,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

interface ViolationReport {
  fileName: string;
  personId: string;
  createdAt: Date;
  size: number;
  path: string;
}

interface ViolationData {
  personId: string;
  violations: string[];
  timestamp: string;
  location: string;
  totalViolations: number;
}

const ViolationsPage = () => {
  const [reports, setReports] = useState<ViolationReport[]>([]);
  const [violations, setViolations] = useState<ViolationData[]>([]);
  const [statistics, setStatistics] = useState({
    totalPersons: 0,
    totalViolations: 0,
    totalReports: 0,
    averageViolationsPerPerson: 0,
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);

      const baseUrl = "http://localhost:3001";

      // Fetch reports
      const reportsResponse = await fetch(`${baseUrl}/api/violations/reports`);
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        setReports(reportsData);
      } else {
        console.error("Reports response not ok:", reportsResponse.status);
      }

      // Fetch violations
      const violationsResponse = await fetch(`${baseUrl}/api/violations/data`);
      if (violationsResponse.ok) {
        const violationsData = await violationsResponse.json();
        setViolations(violationsData);
      } else {
        console.error("Violations response not ok:", violationsResponse.status);
      }

      // Fetch statistics
      const statsResponse = await fetch(`${baseUrl}/api/violations/statistics`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData);
      } else {
        console.error("Statistics response not ok:", statsResponse.status);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch violation data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const downloadReport = async (fileName: string) => {
    try {
      setDownloading(fileName);

      const baseUrl = "http://localhost:3001";
      const response = await fetch(
        `${baseUrl}/api/violations/download/${fileName}`
      );
      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${fileName}`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the report",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const deleteReport = async (fileName: string) => {
    try {
      const baseUrl = "http://localhost:3001";
      const response = await fetch(
        `${baseUrl}/api/violations/delete/${fileName}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete report");
      }

      toast({
        title: "Report Deleted",
        description: `${fileName} has been deleted`,
      });

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the report",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">
                Loading violation reports...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold text-foreground">
              PPE Violation Reports
            </h1>
            <p className="text-muted-foreground">
              View and download violation reports
            </p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {statistics.totalPersons}
                </p>
                <p className="text-sm text-muted-foreground">Persons Tracked</p>
              </div>
            </Card>
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">
                  {statistics.totalViolations}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Violations
                </p>
              </div>
            </Card>
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">
                  {statistics.totalReports}
                </p>
                <p className="text-sm text-muted-foreground">PDF Reports</p>
              </div>
            </Card>
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">
                  {statistics.averageViolationsPerPerson.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">Avg per Person</p>
              </div>
            </Card>
          </div>

          {/* Reports Section */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                PDF Reports
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No reports available</p>
                <p className="text-sm text-muted-foreground">
                  Reports will appear when PPE violations are detected
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.fileName}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {report.fileName}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {report.personId}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(report.createdAt)}
                          </span>
                          <span>{formatFileSize(report.size)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(report.fileName)}
                        disabled={downloading === report.fileName}
                      >
                        {downloading === report.fileName ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteReport(report.fileName)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Violations */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Recent Violations
            </h2>

            {violations.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No violations recorded</p>
              </div>
            ) : (
              <div className="space-y-4">
                {violations.map((violation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Person: {violation.personId}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {violation.violations.map((v, i) => (
                            <Badge
                              key={i}
                              variant="destructive"
                              className="text-xs"
                            >
                              {v.replace(/-/g, " ").toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(violation.timestamp)} • Total:{" "}
                          {violation.totalViolations}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ViolationsPage;
