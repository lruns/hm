package ru.neyvan.hm.terms;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class ArithmeticProgression extends Term {
    private int first, difference;

    public ArithmeticProgression(){super();}
    public ArithmeticProgression(int ID, int first, int difference) {
        super(ID);
        this.first = first;
        this.difference = difference;
    }
    private int a;
    @Override
    public boolean checkCondition(int numberToCheck) {
        a = first; if(a==numberToCheck)return true;
        while (a<numberToCheck){
            a += difference;
            if(a==numberToCheck)return true;
        }
        return false;
    }

    public int getFirst() {
        return first;
    }

    public int getDifference() {
        return difference;
    }
    //    public static void main (String[] args){
//        int a = 0;
//        do{
//            a += 2;
//            if(a==30){
//                System.out.print(true);return;
//            }
//        }while (a<30);
//        System.out.print(false);
// }
    @Override
    public String printDescription() {
        return HM.game.bundle.format("arithmeticProgression", first, difference);
    }
}
