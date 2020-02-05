package ru.neyvan.hm.terms;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class SquareNumber extends Term {
    public SquareNumber(){super();}
    public SquareNumber(int ID) {
        super(ID);
    }
    private double d, d2;
    private int i;
    @Override
    public boolean checkCondition(int numberToCheck) {
        d = Math.sqrt(numberToCheck);
        i= (int) d;
        d2= d- i;
        return d2 == 0;
    }
//    public static void main (String[] args){
//        double d= Math.sqrt(9);
//        int i= (int) d;
//        double d2= d- i;
//        System.out.println(d2==0);
//        System.out.println(d);
//        System.out.println(i);
//        System.out.println(d2);
//
//
// }

}
