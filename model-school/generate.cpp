// Exact finite-horizon Bellman DP. Build WITHOUT -ffast-math.
#include <algorithm>
#include <array>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <numeric>
#include <set>
#include <string>
#include <vector>
using namespace std;
using Counts=array<int,6>;
constexpr int STRIDE=3752, SLOTS=960512, P=4368, T=252, HN=462;
const double NEG=-numeric_limits<double>::infinity();
vector<Counts> holds,totals; vector<int> sh,st,ptr; vector<double> prob;
array<array<int,6>,P> child; int lookup[HN][T]; int score[2][T][13];
vector<int> sums[64]; int offsets[64], indexSum[64][127]; vector<double> lut(SLOTS, numeric_limits<double>::quiet_NaN());
int bonus(int s){return s<0?-30:s<=10?0:30;}
int sn(int n,int matches,bool first){return n*(matches-3)+(first&&matches>=3?n:0);}
void vectors(int n,int d,Counts &v,vector<Counts>&out){if(d==5){v[d]=n;out.push_back(v);return;}for(int x=0;x<=n;x++){v[d]=x;vectors(n-x,d+1,v,out);}}
int size(const Counts &a){return accumulate(a.begin(),a.end(),0);}
int standard(const Counts &v,int c,bool first){int b=0; if(c==0||c==2||c==5||c==6){int n=c==0?2:c==2?3:c==5?4:5;for(int j=0;j<6;j++)if(v[j]>=n)b=max(b,n*(j+1));}else if(c==1||c==4){int n=c==1?2:3;for(int a=0;a<6;a++)for(int z=0;z<6;z++)if(v[a]>=n&&v[z]>=2&&(a!=z||v[a]>=n+2))b=max(b,n*(a+1)+2*(z+1));}else if(c==3){if(v==Counts{1,1,1,1,1,0})b=15;if(v==Counts{0,1,1,1,1,1})b=20;}return b*(first?2:1)+(c==6&&b?50:0);}
int idx(int a,int h,int s,int e){assert(s>=-63&&s<=63);int j=indexSum[h][s+63];assert(j>=0);return (a*STRIDE+offsets[h]+j)*2+e;}
void init(){
 Counts v{};for(int n=0;n<=5;n++)vectors(n,0,v,holds);vectors(5,0,v,totals);
 fill(&lookup[0][0],&lookup[0][0]+HN*T,-1);double fact[]={1,1,2,6,24,120};
 for(int h=0;h<HN;h++){ptr.push_back(sh.size());for(int t=0;t<T;t++){bool ok=true;double den=1;for(int j=0;j<6;j++){int d=totals[t][j]-holds[h][j];if(d<0){ok=false;break;}den*=fact[d];}if(ok){lookup[h][t]=sh.size();sh.push_back(h);st.push_back(t);prob.push_back(fact[5-size(holds[h])]/den/pow(6,5-size(holds[h])));}}}ptr.push_back(sh.size());assert(sh.size()==P);
 for(int p=0;p<P;p++){child[p].fill(-1);for(int j=0;j<6;j++)if(holds[sh[p]][j]<totals[st[p]][j]){auto c=holds[sh[p]];c[j]++;int hh=find(holds.begin(),holds.end(),c)-holds.begin();child[p][j]=lookup[hh][st[p]];assert(child[p][j]>p);}}
 for(int f=0;f<2;f++)for(int t=0;t<T;t++)for(int c=0;c<13;c++)score[f][t][c]=c<7?standard(totals[t],c,f):sn(c-6,totals[t][c-7],f);
 fill(&indexSum[0][0],&indexSum[0][0]+64*127,-1);int off=0;
 for(int h=0;h<64;h++){set<int> ss{0};for(int j=0;j<6;j++)if(!(h&(1<<j))){set<int> nn;for(int s:ss)for(int k=-3;k<=3;k++)nn.insert(s+k*(j+1));ss=move(nn);}sums[h]=vector<int>(ss.begin(),ss.end());offsets[h]=off;for(int j=0;j<(int)sums[h].size();j++)indexSum[h][sums[h][j]+63]=j;off+=sums[h].size();}assert(off==STRIDE);
}
struct Turn{
 double stops[2][2][T], stage[2][5][P];
 void expectation(const double* values,double* ev){for(int h=0;h<HN;h++){double x=0;for(int p=ptr[h];p<ptr[h+1];p++)x+=prob[p]*values[p];ev[h]=size(holds[h])==5?NEG:x;}}
 void step(const double* next,const double* stop,double cost,double* out){double ev[HN],best[P];expectation(next,ev);for(int p=P-1;p>=0;p--){double b=ev[sh[p]]-cost;for(int j=0;j<6;j++){int c=child[p][j];if(c>=0)b=max(b,best[c]);}best[p]=b;out[p]=max(stop[st[p]],b);}}
 void solve(int a,int h,int s){
  for(int e=0;e<2;e++)for(int f=0;f<2;f++)for(int t=0;t<T;t++){double b=NEG;for(int c=0;c<13;c++)if(c<7?(a&(1<<c)):(h&(1<<(c-7)))){int q=score[f][t][c];int k=c<7?idx(a^(1<<c),h,s,e):idx(a,h^(1<<(c-7)),s+q,e);assert(isfinite(lut[k]));b=max(b,q+lut[k]);}stops[e][f][t]=b;}
  for(int p=0;p<P;p++){stage[0][4][p]=stops[0][0][st[p]];stage[0][3][p]=stops[0][0][st[p]];}
  step(stage[0][3],stops[0][0],0,stage[0][2]);step(stage[0][2],stops[0][1],0,stage[0][1]);
  step(stage[0][4],stops[1][0],10,stage[1][3]);step(stage[1][3],stops[1][0],0,stage[1][2]);step(stage[1][2],stops[1][1],0,stage[1][1]);
 }
 double boundary(int e){double out=0;for(int p=ptr[0];p<ptr[1];p++)out+=prob[p]*stage[e][1][p];return out;}
};
void metadata(const string& root){ofstream o(root+"/school-model.json");o<<"{\n\"version\":1,\"layout\":\"standard-school-sum-extra\",\"sumStride\":3752,\"slotCount\":960512,\"dtype\":\"float64\",\"endianness\":\"little\",\"byteLength\":7684096,\"valuesFile\":\"school-values.bin\",\"rulesVersion\":\"school-1\",\"sumOffsets\":[";for(int h=0;h<64;h++)o<<(h?",":"")<<offsets[h];o<<"],\"sumsByRemaining\":[";for(int h=0;h<64;h++){o<<(h?",":"")<<"[";for(int j=0;j<(int)sums[h].size();j++)o<<(j?",":"")<<sums[h][j];o<<"]";}o<<"],\"startValue\":["<<setprecision(17)<<lut[idx(127,63,0,0)]<<","<<lut[idx(127,63,0,1)]<<"],\"method\":\"exhaustive Bellman dynamic programming, permanent-lock geometry; no sampling or heuristic leaves\"}\n";}
void query(int argc,char**argv){assert(argc==20);string root=argv[2];ifstream f(root+"/school-values.bin",ios::binary);f.read((char*)lut.data(),SLOTS*8);assert(f.gcount()==SLOTS*8);int a=stoi(argv[3]),h=stoi(argv[4]),s=stoi(argv[5]),e=stoi(argv[6]),r=stoi(argv[7]);Counts t{},locked{};for(int j=0;j<6;j++){t[j]=stoi(argv[8+j]);locked[j]=stoi(argv[14+j]);}
 int ti=find(totals.begin(),totals.end(),t)-totals.begin();assert(ti<T);Turn turn;turn.solve(a,h,s);cout<<setprecision(17)<<"[";bool comma=false;auto sep=[&](){if(comma)cout<<",";comma=true;};for(int c=0;c<13;c++)if(c<7?(a&(1<<c)):(h&(1<<(c-7)))){int q=score[r==1][ti][c];int k=c<7?idx(a^(1<<c),h,s,e):idx(a,h^(1<<(c-7)),s+q,e);sep();cout<<"{\"type\":\"score\",\"category\":"<<c<<",\"points\":"<<q<<",\"ev\":"<<q+lut[k]<<"}";if(c<7&&q){sep();cout<<"{\"type\":\"score\",\"category\":"<<c<<",\"points\":0,\"ev\":"<<lut[k]<<"}";}}
 if(r<3||(r==3&&e)){double ev[HN];turn.expectation(turn.stage[r==3?0:e][r+1],ev);for(int hh=0;hh<HN;hh++){if(size(holds[hh])==5)continue;bool ok=true;for(int j=0;j<6;j++)if(holds[hh][j]<locked[j]||holds[hh][j]>t[j])ok=false;if(!ok)continue;sep();cout<<"{\"type\":\"reroll\",\"hold\":[";for(int j=0;j<6;j++)cout<<(j?",":"")<<holds[hh][j];cout<<"],\"ev\":"<<ev[hh]-(r==3?10:0)<<"}";}}cout<<"]\n";
}
int main(int argc,char**argv){init();if(argc>1&&string(argv[1])=="--query"){query(argc,argv);return 0;}string root=argc>1?argv[1]:".";auto start=chrono::steady_clock::now();for(int s:sums[0])for(int e=0;e<2;e++)lut[idx(0,0,s,e)]=bonus(s);
 for(int layer=1;layer<=13;layer++){
 #pragma omp parallel for schedule(dynamic,1)
 for(int mask=1;mask<8192;mask++){if(__builtin_popcount((unsigned)mask)!=layer)continue;int a=mask&127,h=mask>>7;Turn turn;
 // Exact equivalence classes: identical B(s+future) for every possible future
 // school sum. Only canonical representatives are solved, all slots populated.
 vector<int> future{0};for(int j=0;j<6;j++)if(h&(1<<j)){set<int> nn;for(int s:future)for(int k=-3;k<=3;k++)nn.insert(s+k*(j+1));future.assign(nn.begin(),nn.end());}
 vector<string> signatures;vector<int> representatives;
 for(int s:sums[h]){string sig;for(int t:future)sig.push_back(char(bonus(s+t)+30));auto found=find(signatures.begin(),signatures.end(),sig);if(found!=signatures.end()){int rep=representatives[found-signatures.begin()];for(int e=0;e<2;e++)lut[idx(a,h,s,e)]=lut[idx(a,h,rep,e)];}else{turn.solve(a,h,s);for(int e=0;e<2;e++)lut[idx(a,h,s,e)]=turn.boundary(e);signatures.push_back(move(sig));representatives.push_back(s);}}
 }
 cerr<<"layer "<<layer<<"/13 elapsed="<<chrono::duration<double>(chrono::steady_clock::now()-start).count()<<"s\n";
 }
 for(double x:lut)assert(isfinite(x));uint16_t endian=1;assert(*(char*)&endian==1);ofstream out(root+"/school-values.bin",ios::binary);out.write((char*)lut.data(),SLOTS*8);out.close();metadata(root);cerr<<setprecision(17)<<"DONE start="<<lut[idx(127,63,0,1)]<<" slots="<<lut.size()<<"\n";
}
